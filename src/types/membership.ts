export interface ClientMembership {
  id: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending_payment' | 'pending_activation' | 'paused';
  start_date: string | null;
  end_date: string | null;
  classes_remaining: number | null;
  plan_name: string | null;
  plan_price: number | null;
  plan_currency: string | null;
  plan_duration_days: number | null;
  class_limit: number | null;
  payment_method?: 'cash' | 'transfer' | 'card' | 'online' | null;
  payment_reference?: string | null;
}
