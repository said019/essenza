export interface BookingAdmin {
  booking_id: string;
  booking_status: 'confirmed' | 'waitlist' | 'checked_in' | 'no_show' | 'cancelled';
  created_at: string;
  checked_in_at: string | null;
  waitlist_position: number | null;
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  class_id: string;
  class_date: string;
  class_start_time: string;
  class_end_time: string;
  class_name: string;
  instructor_name: string;
  membership_id: string | null;
  plan_name: string | null;
}

export interface BookingClient {
  booking_id: string;
  class_id: string;
  date: string;
  start_time: string;
  end_time: string;
  class_type_name: string;
  class_type_color?: string;
  level?: string;
  instructor_name: string;
  booking_status: 'confirmed' | 'waitlist' | 'checked_in' | 'no_show' | 'cancelled';
}
