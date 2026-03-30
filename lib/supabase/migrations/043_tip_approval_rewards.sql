-- Award +5 points when a commuter tip is approved
-- Trigger fires on UPDATE when is_approved changes from false to true

create or replace function public.award_tip_points()
returns trigger as $$
declare
  v_profile_id uuid;
  v_current_points integer;
  v_new_points integer;
  v_new_level text;
  tip_points constant integer := 5;
begin
  -- Only fire when tip is newly approved
  if OLD.is_approved = true or NEW.is_approved = false then
    return NEW;
  end if;

  -- Find the contributor profile by device_id
  select id, total_points into v_profile_id, v_current_points
    from public.contributor_profiles
    where device_id = NEW.device_id
    limit 1;

  -- No profile? Skip (anonymous/unregistered device)
  if v_profile_id is null then
    return NEW;
  end if;

  v_new_points := v_current_points + tip_points;

  -- Calculate new level
  v_new_level := case
    when v_new_points >= 500 then 'troski_legend'
    when v_new_points >= 200 then 'local_expert'
    when v_new_points >= 50  then 'regular'
    else 'passenger'
  end;

  -- Update profile points + level
  update public.contributor_profiles
    set total_points = v_new_points,
        current_level = v_new_level,
        updated_at = now()
    where id = v_profile_id;

  -- Log in points history
  insert into public.points_history (contributor_id, points, reason, report_type, metadata)
    values (
      v_profile_id,
      tip_points,
      'tip_approved',
      'tip',
      jsonb_build_object('tip_id', NEW.id, 'tip_category', NEW.category)
    );

  return NEW;
end;
$$ language plpgsql security definer;

-- Attach trigger
drop trigger if exists trg_tip_approval_rewards on public.commuter_tips;
create trigger trg_tip_approval_rewards
  after update on public.commuter_tips
  for each row
  execute function public.award_tip_points();
