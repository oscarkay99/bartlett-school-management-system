-- =====================================================================================================
-- Operations: attendance, grades & report cards, inventory, expenses & budgets, messages, approvals list.
-- =====================================================================================================

-- ---------- Attendance (one mark per student per school day) ----------
create table public.attendance (
  student_id uuid not null references public.students(id) on delete cascade,
  on_date date not null,
  status text not null check (status in ('Present', 'Absent', 'Late', 'Excused', 'Sick')),
  note text,
  recorded_by uuid default auth.uid(), recorded_at timestamptz not null default now(),
  primary key (student_id, on_date)
);
create index attendance_date_idx on public.attendance (on_date);

-- ---------- Grades: entered per class + subject + term, then submitted, approved, published ----------
create table public.grade_batches (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  status text not null default 'Draft' check (status in ('Draft', 'Submitted', 'Approved', 'Returned', 'Published')),
  return_note text,
  submitted_by uuid, submitted_at timestamptz, approved_by uuid, approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (class_id, subject_id, term_id)
);
create table public.grades (
  batch_id uuid not null references public.grade_batches(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  ca numeric(5,2) check (ca between 0 and 40),           -- continuous assessment /40
  exam numeric(5,2) check (exam between 0 and 60),       -- examination /60
  primary key (batch_id, student_id)
);
create table public.grade_scale (
  grade text primary key, min_total numeric(5,2) not null, label text not null
);
create table public.report_remarks (
  student_id uuid not null references public.students(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  class_teacher_remark text, head_remark text,
  primary key (student_id, term_id)
);

-- Grades can only change while their batch is a Draft or Returned.
create or replace function app.grades_editable() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
declare st text;
begin
  select status into st from public.grade_batches where id = coalesce(new.batch_id, old.batch_id);
  if not found and tg_op = 'DELETE' then return old; end if;
  if st not in ('Draft', 'Returned') then raise exception 'Grades are locked once the batch is % ', st; end if;
  return coalesce(new, old);
end $$;
create trigger grades_editable before insert or update or delete on public.grades for each row execute function app.grades_editable();

-- Batch status only moves through these functions.
create or replace function app.guard_grade_batch() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
begin
  if current_setting('app.grade_fn', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and new.status = 'Draft' then return new; end if;
  if tg_op = 'UPDATE' and new.status = old.status and old.status in ('Draft', 'Returned') then return new; end if;
  raise exception 'Use submit_grade_batch / decide_grade_batch / publish_grade_batch to change a batch''s status';
end $$;
create trigger guard_grade_batch before insert or update or delete on public.grade_batches for each row execute function app.guard_grade_batch();

create or replace function public.submit_grade_batch(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if not (app.has_role('owner', 'admin') or (app.has_role('teacher') and app.teaches((select class_id from public.grade_batches where id = p_id)))) then
    raise exception 'Only the class''s teacher (or Owner/Admin) can submit these grades' using errcode = '42501'; end if;
  perform set_config('app.grade_fn', 'on', true);
  update public.grade_batches set status = 'Submitted', submitted_by = auth.uid(), submitted_at = now() where id = p_id and status in ('Draft', 'Returned');
  if not found then raise exception 'Only draft or returned batches can be submitted'; end if;
  perform set_config('app.grade_fn', 'off', true);
end $$;
create or replace function public.decide_grade_batch(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if not app.has_role('owner', 'admin') then raise exception 'Only the Owner or Administrator approves grades' using errcode = '42501'; end if;
  perform set_config('app.grade_fn', 'on', true);
  update public.grade_batches set status = case when p_approve then 'Approved' else 'Returned' end, return_note = case when p_approve then null else p_note end,
         approved_by = case when p_approve then auth.uid() end, approved_at = case when p_approve then now() end
   where id = p_id and status = 'Submitted';
  if not found then raise exception 'Only submitted batches can be decided'; end if;
  perform set_config('app.grade_fn', 'off', true);
end $$;
create or replace function public.publish_grade_batch(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if not app.has_role('owner', 'admin') then raise exception 'Only the Owner or Administrator publishes grades' using errcode = '42501'; end if;
  perform set_config('app.grade_fn', 'on', true);
  update public.grade_batches set status = 'Published' where id = p_id and status = 'Approved';
  if not found then raise exception 'Only approved batches can be published'; end if;
  perform set_config('app.grade_fn', 'off', true);
end $$;

-- ---------- Inventory ----------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique, name text not null, category text not null, unit text not null,
  location text, supplier text,
  unit_cost bigint not null default 0 check (unit_cost >= 0),
  reorder_level int not null default 0, max_level int,
  kind text not null check (kind in ('Consumable', 'Reusable', 'Asset')),
  expiry date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Every stock change is a movement; on-hand is the running sum. Movements are never edited or deleted.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  on_date date not null default current_date,
  kind text not null check (kind in ('Opening', 'Received', 'Issued', 'Returned', 'Damaged', 'Lost', 'Adjustment')),
  qty int not null check (qty <> 0),               -- positive; Adjustment may be negative
  reference text, issued_to text, note text,
  student_id uuid references public.students(id) on delete set null,   -- when issued to a student
  return_required boolean not null default false,
  recorded_by uuid default auth.uid(), recorded_at timestamptz not null default now()
);
create index stock_movements_item_idx on public.stock_movements (item_id);
create or replace function app.movements_append_only() returns trigger language plpgsql as $$
begin raise exception 'Stock movements cannot be changed; record a correcting Adjustment instead'; end $$;
create trigger append_only before update or delete on public.stock_movements for each row execute function app.movements_append_only();

create view public.inventory_on_hand with (security_invoker = true) as
select i.id as item_id,
       coalesce(sum(case when m.kind in ('Opening', 'Received', 'Returned', 'Adjustment') then m.qty else -m.qty end), 0)::int as on_hand
from public.inventory_items i left join public.stock_movements m on m.item_id = i.id
group by i.id;

-- ---------- Expenses & budgets ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  on_date date not null default current_date,
  category text not null, vendor text not null, description text,
  amount bigint not null check (amount > 0),
  method text, department text,
  status text not null default 'Pending Approval' check (status in ('Pending Approval', 'Approved', 'Rejected', 'Paid')),
  receipt_path text,
  requested_by uuid default auth.uid(), requested_at timestamptz not null default now(),
  decided_by uuid, decided_at timestamptz, decision_note text
);
create or replace function app.guard_expense() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
begin
  if current_setting('app.expense_fn', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.status <> 'Pending Approval' then raise exception 'Expenses start as pending approval'; end if;
    new.no := app.next_no('EXP', 4); return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'Pending Approval' and new.status = old.status and new.amount = old.amount then return new; end if;
  raise exception 'Use decide_expense / mark_expense_paid; approved expenses cannot be edited or deleted';
end $$;
create trigger guard_expense before insert or update or delete on public.expenses for each row execute function app.guard_expense();

-- Approve or reject, within the approver's limit from Settings (tier 1 Bursar, tier 2 Administrator, above that the Owner).
create or replace function public.decide_expense(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
declare amt bigint; t1 bigint; t2 bigint; ok boolean;
begin
  select amount into amt from public.expenses where id = p_id and status = 'Pending Approval';
  if not found then raise exception 'Expense is not pending approval'; end if;
  select expense_tier1_limit, expense_tier2_limit into t1, t2 from public.school_settings;
  ok := app.has_role('owner') or (app.has_role('admin') and amt <= t2) or (app.has_role('bursar') and amt <= t1);
  if not ok then raise exception 'This amount needs a higher approver' using errcode = '42501'; end if;
  perform set_config('app.expense_fn', 'on', true);
  update public.expenses set status = case when p_approve then 'Approved' else 'Rejected' end, decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = p_id;
  perform set_config('app.expense_fn', 'off', true);
end $$;
create or replace function public.mark_expense_paid(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if not app.has_role('owner', 'bursar') then raise exception 'Only the Bursar or Owner marks expenses paid' using errcode = '42501'; end if;
  perform set_config('app.expense_fn', 'on', true);
  update public.expenses set status = 'Paid' where id = p_id and status = 'Approved';
  if not found then raise exception 'Only approved expenses can be marked paid'; end if;
  perform set_config('app.expense_fn', 'off', true);
end $$;

create table public.budget_lines (
  year_id uuid not null references public.academic_years(id) on delete cascade,
  category text not null,
  amount bigint not null check (amount >= 0),
  primary key (year_id, category)
);

-- ---------- Messages to parents (log) and templates ----------
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, channel text check (channel in ('SMS', 'WhatsApp', 'Email')),
  body text not null, updated_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  guardian_id uuid references public.guardians(id) on delete set null,
  student_ids uuid[] not null default '{}',
  channel text not null check (channel in ('SMS', 'WhatsApp', 'Email')),
  template text, body text not null,
  amount bigint,                                    -- balance quoted in a reminder
  status text not null default 'Recorded' check (status in ('Recorded', 'Queued', 'Sent', 'Delivered', 'Failed')),
  failure text,
  sent_by uuid default auth.uid()
);

select app.track(t) from unnest(array['public.attendance', 'public.grade_batches', 'public.grades', 'public.grade_scale', 'public.report_remarks',
  'public.inventory_items', 'public.stock_movements', 'public.expenses', 'public.budget_lines', 'public.message_templates', 'public.messages']::regclass[]) t;

-- =====================================================================================================
-- Policies
-- =====================================================================================================
-- Attendance: Owner/Admin all classes; teachers only classes they teach.
create policy office on public.attendance for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));
create policy teacher on public.attendance for all to authenticated
  using (app.has_role('teacher') and app.teaches((select class_id from public.students s where s.id = student_id)))
  with check (app.has_role('teacher') and app.teaches((select class_id from public.students s where s.id = student_id)));

-- Grades: Owner/Admin see all; teachers see and edit batches of classes they teach. Status changes via functions.
create policy office on public.grade_batches for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));
create policy teacher on public.grade_batches for all to authenticated using (app.has_role('teacher') and app.teaches(class_id)) with check (app.has_role('teacher') and app.teaches(class_id));
create policy office on public.grades for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));
create policy teacher on public.grades for all to authenticated
  using (app.has_role('teacher') and app.teaches((select class_id from public.grade_batches b where b.id = batch_id)))
  with check (app.has_role('teacher') and app.teaches((select class_id from public.grade_batches b where b.id = batch_id)));
create policy read_all on public.grade_scale for select to authenticated using (app.my_role() is not null);
create policy write_owner on public.grade_scale for all to authenticated using (app.has_role('owner')) with check (app.has_role('owner'));
create policy office on public.report_remarks for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));
create policy teacher on public.report_remarks for all to authenticated
  using (app.has_role('teacher') and app.teaches((select class_id from public.students s where s.id = student_id)))
  with check (app.has_role('teacher') and app.teaches((select class_id from public.students s where s.id = student_id)));

-- Inventory: Owner/Storekeeper manage; Auditor reads. Movements: insert only (append-only trigger blocks the rest).
create policy read on public.inventory_items for select to authenticated using (app.has_role('owner', 'storekeeper', 'auditor'));
create policy write on public.inventory_items for all to authenticated using (app.has_role('owner', 'storekeeper')) with check (app.has_role('owner', 'storekeeper'));
create policy read on public.stock_movements for select to authenticated using (app.has_role('owner', 'storekeeper', 'auditor'));
create policy record on public.stock_movements for insert to authenticated with check (app.has_role('owner', 'storekeeper'));

-- Expenses & budgets: Owner/Bursar/Auditor read; Owner/Bursar request and edit pending ones; Admin reads to approve within its limit.
create policy read on public.expenses for select to authenticated using (app.has_role('owner', 'bursar', 'auditor', 'admin'));
create policy request on public.expenses for insert to authenticated with check (app.has_role('owner', 'bursar'));
create policy edit_pending on public.expenses for update to authenticated using (app.has_role('owner', 'bursar')) with check (app.has_role('owner', 'bursar'));
create policy read on public.budget_lines for select to authenticated using (app.has_role('owner', 'bursar', 'auditor'));
create policy write on public.budget_lines for all to authenticated using (app.has_role('owner')) with check (app.has_role('owner'));

-- Messages: Owner/Admin/Bursar read and record (Bursar for fee reminders); templates read by them, edited by Owner/Admin.
create policy read on public.messages for select to authenticated using (app.has_role('owner', 'admin', 'bursar', 'auditor'));
create policy record on public.messages for insert to authenticated with check (app.has_role('owner', 'admin', 'bursar'));
create policy read on public.message_templates for select to authenticated using (app.has_role('owner', 'admin', 'bursar'));
create policy write on public.message_templates for all to authenticated using (app.has_role('owner', 'admin')) with check (app.has_role('owner', 'admin'));

-- ---------- Everything waiting for a decision, in one list (each role sees only what it may read) ----------
create view public.pending_approvals with (security_invoker = true) as
  select 'invoice'::text as kind, i.id, coalesce(s.first_name || ' ' || s.last_name, '') || ' — ' || i.account::text || ' invoice' as title,
         app.invoice_total(i.id) as amount, i.submitted_at as since
    from public.invoices i join public.students s on s.id = i.student_id where i.status = 'submitted'
  union all
  select 'adjustment', a.id, a.reason, a.amount, a.requested_at from public.invoice_adjustments a where a.status = 'pending'
  union all
  select 'expense', e.id, e.vendor || ' — ' || e.category, e.amount, e.requested_at from public.expenses e where e.status = 'Pending Approval'
  union all
  select 'grades', b.id, c.name || ' — ' || sub.name, null, b.submitted_at
    from public.grade_batches b join public.classes c on c.id = b.class_id join public.subjects sub on sub.id = b.subject_id where b.status = 'Submitted';
revoke all on public.pending_approvals, public.inventory_on_hand from anon;
grant select on public.pending_approvals, public.inventory_on_hand to authenticated;

grant execute on function public.submit_grade_batch(uuid), public.decide_grade_batch(uuid, boolean, text), public.publish_grade_batch(uuid),
  public.decide_expense(uuid, boolean, text), public.mark_expense_paid(uuid) to authenticated;
