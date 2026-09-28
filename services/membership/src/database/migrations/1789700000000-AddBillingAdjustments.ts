import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingAdjustments1789700000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE billing_policy_versions (
        policy_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), club_id uuid NOT NULL REFERENCES clubs(id),
        effective_date date NOT NULL, policy jsonb NOT NULL, actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(club_id,effective_date)
      );
      CREATE TABLE fee_revisions (
        revision_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), club_id uuid NOT NULL REFERENCES clubs(id),
        fee_structure_id uuid NOT NULL REFERENCES fee_structures(fee_structure_id), effective_date date NOT NULL,
        amount_minor bigint NOT NULL CHECK(amount_minor>=0), actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(club_id,fee_structure_id,effective_date)
      );
      CREATE TABLE billing_runs (
        run_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), club_id uuid NOT NULL REFERENCES clubs(id), family_id uuid NOT NULL REFERENCES families(family_id),
        period_start date NOT NULL, period_end date NOT NULL CHECK(period_end>=period_start), frequency text NOT NULL,
        invoice_id uuid NOT NULL REFERENCES invoices(invoice_id), snapshot jsonb NOT NULL, request_hash text NOT NULL,
        actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(club_id,family_id,frequency,period_start,period_end)
      );
      CREATE TABLE billing_credit_notes (
        credit_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), club_id uuid NOT NULL REFERENCES clubs(id), invoice_id uuid NOT NULL REFERENCES invoices(invoice_id),
        item_id uuid REFERENCES invoice_items(item_id), amount_minor bigint NOT NULL CHECK(amount_minor>0),
        currency varchar(3) NOT NULL, kind text NOT NULL CHECK(kind IN ('credit','reversal')), reverses_id uuid REFERENCES billing_credit_notes(credit_id),
        reason text NOT NULL, source_event text NOT NULL, snapshot jsonb NOT NULL, request_hash text NOT NULL, actor_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(club_id,source_event), UNIQUE(reverses_id)
      );
      CREATE TABLE billing_credit_allocations (
        allocation_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), club_id uuid NOT NULL REFERENCES clubs(id), source_event text NOT NULL,
        UNIQUE(club_id, source_event),
        source_invoice_id uuid NOT NULL REFERENCES invoices(invoice_id),
        target_invoice_id uuid NOT NULL REFERENCES invoices(invoice_id), amount_minor bigint NOT NULL CHECK(amount_minor>0),
        actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CHECK(source_invoice_id<>target_invoice_id)
      );
      CREATE TABLE billing_payment_operations (
        operation_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), club_id uuid NOT NULL REFERENCES clubs(id), invoice_id uuid NOT NULL REFERENCES invoices(invoice_id),
        payment_id uuid REFERENCES payments(payment_id), kind text NOT NULL CHECK(kind IN ('collection','refund')),
        amount_minor bigint NOT NULL CHECK(amount_minor>0), currency varchar(3) NOT NULL, provider text NOT NULL, external_account_id text NOT NULL,
        revision integer NOT NULL DEFAULT 0, needs_reconciliation boolean NOT NULL DEFAULT true, provider_id text, state text NOT NULL CHECK(state IN ('requested','pending','confirmed','failed','uncertain')),
        request jsonb NOT NULL, request_hash text NOT NULL, actor_id uuid, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(provider,external_account_id,provider_id,kind)
      );
      CREATE INDEX billing_operations_invoice ON billing_payment_operations(club_id,invoice_id);
      CREATE INDEX billing_credits_invoice ON billing_credit_notes(club_id,invoice_id);
      ALTER TABLE payments ADD COLUMN provider_account_id varchar(255);

      CREATE FUNCTION billing_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'Billing audit records are append-only';
      END $$;
      CREATE TRIGGER immutable_credit_notes BEFORE UPDATE OR DELETE ON billing_credit_notes FOR EACH ROW EXECUTE FUNCTION billing_append_only();
      CREATE TRIGGER immutable_allocations BEFORE UPDATE OR DELETE ON billing_credit_allocations FOR EACH ROW EXECUTE FUNCTION billing_append_only();
      CREATE TRIGGER immutable_runs BEFORE UPDATE OR DELETE ON billing_runs FOR EACH ROW EXECUTE FUNCTION billing_append_only();
      CREATE TRIGGER immutable_policies BEFORE UPDATE OR DELETE ON billing_policy_versions FOR EACH ROW EXECUTE FUNCTION billing_append_only();
      CREATE TRIGGER immutable_fee_revisions BEFORE UPDATE OR DELETE ON fee_revisions FOR EACH ROW EXECUTE FUNCTION billing_append_only();
      CREATE FUNCTION billing_protect_invoice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF EXISTS(SELECT 1 FROM billing_runs WHERE invoice_id=OLD.invoice_id)
          OR EXISTS(SELECT 1 FROM billing_credit_notes WHERE invoice_id=OLD.invoice_id)
          OR EXISTS(SELECT 1 FROM billing_credit_allocations WHERE source_invoice_id=OLD.invoice_id OR target_invoice_id=OLD.invoice_id)
          OR EXISTS(SELECT 1 FROM billing_payment_operations WHERE invoice_id=OLD.invoice_id) THEN
          IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Audited invoices cannot be deleted'; END IF;
          IF ROW(NEW.club_id,NEW.family_id,NEW.subtotal,NEW.tax_amount,NEW.total_amount,NEW.currency) IS DISTINCT FROM ROW(OLD.club_id,OLD.family_id,OLD.subtotal,OLD.tax_amount,OLD.total_amount,OLD.currency)
            OR NEW.status IN ('draft','cancelled') THEN RAISE EXCEPTION 'Use a credit note to adjust an audited invoice'; END IF;
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER protect_billing_invoice BEFORE UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION billing_protect_invoice();
      CREATE FUNCTION billing_protect_item() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE inv uuid; BEGIN
        inv := CASE WHEN TG_OP='INSERT' THEN NEW.invoice_id ELSE OLD.invoice_id END;
        IF EXISTS(SELECT 1 FROM billing_runs WHERE invoice_id=inv)
          OR EXISTS(SELECT 1 FROM billing_credit_notes WHERE invoice_id=inv)
          OR EXISTS(SELECT 1 FROM billing_payment_operations WHERE invoice_id=inv) THEN
          RAISE EXCEPTION 'Issued billing lines are immutable';
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER protect_billing_items BEFORE INSERT OR UPDATE OR DELETE ON invoice_items FOR EACH ROW EXECUTE FUNCTION billing_protect_item();
      CREATE FUNCTION billing_protect_fee() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF (NEW.amount IS DISTINCT FROM OLD.amount OR NEW.currency IS DISTINCT FROM OLD.currency)
          AND EXISTS(SELECT 1 FROM fee_revisions WHERE fee_structure_id=OLD.fee_structure_id) THEN
          RAISE EXCEPTION 'Use an effective-dated revision to change this fee';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER protect_billing_fee BEFORE UPDATE ON fee_structures FOR EACH ROW EXECUTE FUNCTION billing_protect_fee();
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER protect_billing_fee ON fee_structures;
      DROP FUNCTION billing_protect_fee();
      DROP TRIGGER protect_billing_items ON invoice_items;
      DROP FUNCTION billing_protect_item();
      DROP TRIGGER protect_billing_invoice ON invoices;
      DROP FUNCTION billing_protect_invoice();
      DROP TRIGGER immutable_credit_notes ON billing_credit_notes;
      DROP TRIGGER immutable_allocations ON billing_credit_allocations;
      DROP TRIGGER immutable_runs ON billing_runs;
      DROP TRIGGER immutable_policies ON billing_policy_versions;
      DROP TRIGGER immutable_fee_revisions ON fee_revisions;
      DROP FUNCTION billing_append_only();
      ALTER TABLE payments DROP COLUMN provider_account_id;
      DROP TABLE billing_payment_operations; DROP TABLE billing_credit_allocations; DROP TABLE billing_credit_notes;
      DROP TABLE billing_runs; DROP TABLE fee_revisions; DROP TABLE billing_policy_versions;`);
  }
}
