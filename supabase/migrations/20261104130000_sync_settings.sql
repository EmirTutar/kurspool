-- Which Classroom courses belong to a batch: those whose section matches exactly.
alter table public.batches add column classroom_section text;

-- A Classroom course is unique per batch, so one batch's sync can't take over another batch's module.
alter table public.modules drop constraint modules_classroom_course_id_key;
alter table public.modules add constraint modules_batch_course_key unique (batch_id, classroom_course_id);
