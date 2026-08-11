-- Migration to fix ON CONFLICT 42P10 constraints and audit trigger exceptions

-- 1. Create UNIQUE constraints on notifications & customers if they do not exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_type_order_id ON public.notifications (type, order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_name ON public.customers (LOWER(name));

-- 2. Safely recreate audit_cartons_change function to prevent ON CONFLICT errors
CREATE OR REPLACE FUNCTION public.audit_cartons_change()
RETURNS TRIGGER AS $$
DECLARE
  order_created_date TEXT;
  age_days NUMERIC;
BEGIN
  IF NEW.dispatch_status = 'Ready' THEN
    SELECT created_date INTO order_created_date
    FROM public.orders
    WHERE order_id = NEW.order_id;

    IF order_created_date IS NOT NULL THEN
      age_days := EXTRACT(epoch FROM (now() - to_timestamp(order_created_date, 'YYYY-MM-DD'))) / 86400;

      IF age_days > 10 THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications WHERE type = 'overdue' AND order_id = NEW.order_id
        ) THEN
          INSERT INTO public.notifications (message, order_id, type, stage_id, read)
          VALUES (
            '[OVERDUE] Carton ' || NEW.carton_id || ' for Order ' || NEW.order_id || ' is overdue for dispatch.',
            NEW.order_id,
            'overdue',
            13,
            false
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Safely recreate audit_materials_hold function
CREATE OR REPLACE FUNCTION public.audit_materials_hold()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inspection_status = 'Hold' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications WHERE type = 'hold' AND order_id = NEW.order_id
    ) THEN
      INSERT INTO public.notifications (message, order_id, type, stage_id, read)
      VALUES (
        '[HOLD] Material ' || NEW.material_id || ' for Order ' || NEW.order_id || ' is on inspection HOLD.',
        NEW.order_id,
        'hold',
        2,
        false
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Safely recreate audit_qc_rejects function
CREATE OR REPLACE FUNCTION public.audit_qc_rejects()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.result = 'Reject' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications WHERE type = 'reject' AND order_id = NEW.order_id
    ) THEN
      INSERT INTO public.notifications (message, order_id, type, stage_id, read)
      VALUES (
        '[REJECT] QC checkpoint "' || NEW.stage_checkpoint || '" failed for Order ' || NEW.order_id || '.',
        NEW.order_id,
        'reject',
        11,
        false
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Safely recreate audit_orders_change function
CREATE OR REPLACE FUNCTION public.audit_orders_change()
RETURNS TRIGGER AS $$
DECLARE
  age_days NUMERIC;
  checkpoint_name TEXT;
  has_qc_record BOOLEAN;
BEGIN
  age_days := EXTRACT(epoch FROM (now() - to_timestamp(NEW.created_date, 'YYYY-MM-DD'))) / 86400;

  IF NEW.status = 'In Production' AND NEW.current_stage < 13 AND age_days > 5 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications WHERE type = 'slow_stage' AND order_id = NEW.order_id
    ) THEN
      INSERT INTO public.notifications (message, order_id, type, stage_id, read)
      VALUES (
        '[DELAY] Order ' || NEW.order_id || ' has been at Stage ' || NEW.current_stage || ' for over 5 days.',
        NEW.order_id,
        'slow_stage',
        NEW.current_stage,
        false
      );
    END IF;
  END IF;

  IF NEW.status = 'In Production' AND NEW.current_stage IN (5, 8, 11, 12) AND age_days > 2 THEN
    checkpoint_name := CASE NEW.current_stage
      WHEN 5 THEN 'First Cut Approval'
      WHEN 8 THEN 'Inline Sewing QC'
      WHEN 11 THEN 'Wash-Finish Approval'
      WHEN 12 THEN 'Final AQL-Packing Audit'
    END;

    SELECT EXISTS (
      SELECT 1 FROM public.qc_records q
      WHERE q.order_id = NEW.order_id AND q.stage_checkpoint = checkpoint_name
    ) INTO has_qc_record;

    IF NOT has_qc_record THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications WHERE type = 'qc_checkpoint_pending' AND order_id = NEW.order_id
      ) THEN
        INSERT INTO public.notifications (message, order_id, type, stage_id, read)
        VALUES (
          '[QC PENDING] Order ' || NEW.order_id || ' at Stage ' || NEW.current_stage || ' for >2 days — "' || checkpoint_name || '" audit not completed.',
          NEW.order_id,
          'qc_checkpoint_pending',
          NEW.current_stage,
          false
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
