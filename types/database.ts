export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          is_secret: boolean
          key: string
          note: string
          updated_at: string
          value: string
        }
        Insert: {
          is_secret?: boolean
          key: string
          note?: string
          updated_at?: string
          value?: string
        }
        Update: {
          is_secret?: boolean
          key?: string
          note?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_fields: string[] | null
          id: number
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_brands: {
        Row: {
          brand_id: string
          campaign_id: string
        }
        Insert: {
          brand_id: string
          campaign_id: string
        }
        Update: {
          brand_id?: string
          campaign_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_brands_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_influencers: {
        Row: {
          assigned_at: string
          campaign_id: string
          influencer_id: string
          submission_link: string | null
          submission_status: string | null
        }
        Insert: {
          assigned_at?: string
          campaign_id: string
          influencer_id: string
          submission_link?: string | null
          submission_status?: string | null
        }
        Update: {
          assigned_at?: string
          campaign_id?: string
          influencer_id?: string
          submission_link?: string | null
          submission_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_influencers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_influencers_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_products: {
        Row: {
          campaign_id: string
          product_id: string
        }
        Insert: {
          campaign_id: string
          product_id: string
        }
        Update: {
          campaign_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_products_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brief_file_url: string | null
          budget: number | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          currency: string
          deadline: string
          description: string
          id: string
          name: string
          start_date: string
          status: string
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          brief_file_url?: string | null
          budget?: number | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          currency?: string
          deadline: string
          description?: string
          id?: string
          name: string
          start_date: string
          status?: string
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          brief_file_url?: string | null
          budget?: number | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          currency?: string
          deadline?: string
          description?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      carry_over_logs: {
        Row: {
          created_at: string
          created_by: string | null
          days_carried: number
          from_year: number
          id: string
          leave_type: string
          note: string
          to_year: number
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days_carried: number
          from_year: number
          id?: string
          leave_type: string
          note?: string
          to_year: number
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days_carried?: number
          from_year?: number
          id?: string
          leave_type?: string
          note?: string
          to_year?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carry_over_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carry_over_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carry_over_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carry_over_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_edits: {
        Row: {
          checkin_id: string
          edited_at: string
          edited_by: string | null
          edited_by_name: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          reason: string
        }
        Insert: {
          checkin_id: string
          edited_at: string
          edited_by?: string | null
          edited_by_name?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string
        }
        Update: {
          checkin_id?: string
          edited_at?: string
          edited_by?: string | null
          edited_by_name?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_edits_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          auto_checkout: boolean
          auto_checkout_at: string | null
          auto_checkout_note: string | null
          break_hours: number
          checkin_lat: number
          checkin_lng: number
          checkin_photo_url: string | null
          checkin_time: string
          checkin_type: string
          checkout_lat: number | null
          checkout_lng: number | null
          checkout_note: string | null
          checkout_time: string | null
          created_at: string
          device_id: string | null
          forgot_checkout: boolean
          hours_status: string
          id: string
          is_late: boolean
          is_overnight_shift: boolean
          late_minutes: number
          locations_in_range: string[]
          manual_checkout: boolean
          manual_checkout_at: string | null
          manual_checkout_by: string | null
          manual_note: string | null
          needs_overtime_approval: boolean
          note: string | null
          overtime_approved: boolean
          overtime_hours: number
          primary_location_id: string | null
          primary_location_name: string | null
          regular_hours: number
          shift_end_time: string | null
          shift_id: string | null
          shift_name: string | null
          shift_start_time: string | null
          status: string
          total_hours: number | null
          updated_at: string
          user_avatar: string
          user_id: string
          user_name: string
          work_date: string
        }
        Insert: {
          auto_checkout?: boolean
          auto_checkout_at?: string | null
          auto_checkout_note?: string | null
          break_hours?: number
          checkin_lat: number
          checkin_lng: number
          checkin_photo_url?: string | null
          checkin_time: string
          checkin_type?: string
          checkout_lat?: number | null
          checkout_lng?: number | null
          checkout_note?: string | null
          checkout_time?: string | null
          created_at?: string
          device_id?: string | null
          forgot_checkout?: boolean
          hours_status?: string
          id?: string
          is_late?: boolean
          is_overnight_shift?: boolean
          late_minutes?: number
          locations_in_range?: string[]
          manual_checkout?: boolean
          manual_checkout_at?: string | null
          manual_checkout_by?: string | null
          manual_note?: string | null
          needs_overtime_approval?: boolean
          note?: string | null
          overtime_approved?: boolean
          overtime_hours?: number
          primary_location_id?: string | null
          primary_location_name?: string | null
          regular_hours?: number
          shift_end_time?: string | null
          shift_id?: string | null
          shift_name?: string | null
          shift_start_time?: string | null
          status?: string
          total_hours?: number | null
          updated_at?: string
          user_avatar?: string
          user_id: string
          user_name?: string
          work_date: string
        }
        Update: {
          auto_checkout?: boolean
          auto_checkout_at?: string | null
          auto_checkout_note?: string | null
          break_hours?: number
          checkin_lat?: number
          checkin_lng?: number
          checkin_photo_url?: string | null
          checkin_time?: string
          checkin_type?: string
          checkout_lat?: number | null
          checkout_lng?: number | null
          checkout_note?: string | null
          checkout_time?: string | null
          created_at?: string
          device_id?: string | null
          forgot_checkout?: boolean
          hours_status?: string
          id?: string
          is_late?: boolean
          is_overnight_shift?: boolean
          late_minutes?: number
          locations_in_range?: string[]
          manual_checkout?: boolean
          manual_checkout_at?: string | null
          manual_checkout_by?: string | null
          manual_note?: string | null
          needs_overtime_approval?: boolean
          note?: string | null
          overtime_approved?: boolean
          overtime_hours?: number
          primary_location_id?: string | null
          primary_location_name?: string | null
          regular_hours?: number
          shift_end_time?: string | null
          shift_id?: string | null
          shift_name?: string | null
          shift_start_time?: string | null
          status?: string
          total_hours?: number | null
          updated_at?: string
          user_avatar?: string
          user_id?: string
          user_name?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_manual_checkout_by_fkey"
            columns: ["manual_checkout_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_manual_checkout_by_fkey"
            columns: ["manual_checkout_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_primary_location_id_fkey"
            columns: ["primary_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name_th: string
          registration_no: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_th: string
          registration_no?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_th?: string
          registration_no?: string | null
        }
        Relationships: []
      }
      delivery_points: {
        Row: {
          address: string
          check_in_time: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          customer_signature: string | null
          delivery_status: string
          delivery_type: string
          driver_id: string
          driver_name: string
          failure_reason: string | null
          id: string
          lat: number
          lng: number
          note: string
          order_number: string | null
          photo_captured_at: string | null
          photo_compressed_size: number | null
          photo_height: number | null
          photo_original_size: number | null
          photo_thumbnail_url: string | null
          photo_uploaded_at: string | null
          photo_url: string | null
          photo_width: number | null
          route_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string
          check_in_time?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_signature?: string | null
          delivery_status?: string
          delivery_type?: string
          driver_id: string
          driver_name?: string
          failure_reason?: string | null
          id?: string
          lat: number
          lng: number
          note?: string
          order_number?: string | null
          photo_captured_at?: string | null
          photo_compressed_size?: number | null
          photo_height?: number | null
          photo_original_size?: number | null
          photo_thumbnail_url?: string | null
          photo_uploaded_at?: string | null
          photo_url?: string | null
          photo_width?: number | null
          route_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          check_in_time?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_signature?: string | null
          delivery_status?: string
          delivery_type?: string
          driver_id?: string
          driver_name?: string
          failure_reason?: string | null
          id?: string
          lat?: number
          lng?: number
          note?: string
          order_number?: string | null
          photo_captured_at?: string | null
          photo_compressed_size?: number | null
          photo_height?: number | null
          photo_original_size?: number | null
          photo_thumbnail_url?: string | null
          photo_uploaded_at?: string | null
          photo_url?: string | null
          photo_width?: number | null
          route_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_points_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_points_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_points_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_routes: {
        Row: {
          completed_points: number
          created_at: string
          driver_id: string
          driver_name: string
          end_time: string | null
          failed_points: number
          id: string
          route_date: string
          start_time: string | null
          status: string
          total_distance: number | null
          total_duration: number | null
          total_points: number
          updated_at: string
        }
        Insert: {
          completed_points?: number
          created_at?: string
          driver_id: string
          driver_name?: string
          end_time?: string | null
          failed_points?: number
          id?: string
          route_date: string
          start_time?: string | null
          status?: string
          total_distance?: number | null
          total_duration?: number | null
          total_points?: number
          updated_at?: string
        }
        Update: {
          completed_points?: number
          created_at?: string
          driver_id?: string
          driver_name?: string
          end_time?: string | null
          failed_points?: number
          id?: string
          route_date?: string
          start_time?: string | null
          status?: string
          total_distance?: number | null
          total_duration?: number | null
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          applicable_location_ids: string[]
          applicable_roles: string[]
          created_at: string
          created_by: string | null
          description: string
          holiday_date: string
          holiday_type: string
          id: string
          is_active: boolean
          is_working_day: boolean
          name: string
          overtime_rates: Json
          recurring: boolean
          recurring_day: number | null
          recurring_month: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applicable_location_ids?: string[]
          applicable_roles?: string[]
          created_at?: string
          created_by?: string | null
          description?: string
          holiday_date: string
          holiday_type?: string
          id?: string
          is_active?: boolean
          is_working_day?: boolean
          name: string
          overtime_rates?: Json
          recurring?: boolean
          recurring_day?: number | null
          recurring_month?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applicable_location_ids?: string[]
          applicable_roles?: string[]
          created_at?: string
          created_by?: string | null
          description?: string
          holiday_date?: string
          holiday_type?: string
          id?: string
          is_active?: boolean
          is_working_day?: boolean
          name?: string
          overtime_rates?: Json
          recurring?: boolean
          recurring_day?: number | null
          recurring_month?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_children: {
        Row: {
          birth_date: string | null
          gender: string | null
          id: string
          influencer_id: string
          nickname: string
        }
        Insert: {
          birth_date?: string | null
          gender?: string | null
          id?: string
          influencer_id: string
          nickname?: string
        }
        Update: {
          birth_date?: string | null
          gender?: string | null
          id?: string
          influencer_id?: string
          nickname?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_children_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          birth_date: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          line_id: string | null
          nickname: string
          notes: string | null
          phone: string
          province: string | null
          shipping_address: string | null
          tier: string
          total_followers: number
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          full_name: string
          id?: string
          is_active?: boolean
          line_id?: string | null
          nickname?: string
          notes?: string | null
          phone?: string
          province?: string | null
          shipping_address?: string | null
          tier?: string
          total_followers?: number
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          line_id?: string | null
          nickname?: string
          notes?: string | null
          phone?: string
          province?: string | null
          shipping_address?: string | null
          tier?: string
          total_followers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_links: {
        Row: {
          allow_checkin_outside_location: boolean
          code: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          default_location_ids: string[]
          default_role: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          note: string
          require_approval: boolean
          updated_at: string
          used_count: number
        }
        Insert: {
          allow_checkin_outside_location?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          default_location_ids?: string[]
          default_role?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          note?: string
          require_approval?: boolean
          updated_at?: string
          used_count?: number
        }
        Update: {
          allow_checkin_outside_location?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          default_location_ids?: string[]
          default_role?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          note?: string
          require_approval?: boolean
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_function_work_days: {
        Row: {
          day_of_week: number
          job_function_id: string
          work_mode: string
        }
        Insert: {
          day_of_week: number
          job_function_id: string
          work_mode: string
        }
        Update: {
          day_of_week?: number
          job_function_id?: string
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_function_work_days_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_functions: {
        Row: {
          code: string
          coverage_days_per_week: number | null
          created_at: string
          default_days_per_week: number | null
          default_role: string | null
          id: string
          is_active: boolean
          name_th: string
          ot_eligible: boolean
          payroll_cycle: string | null
          schedule_type: string
          sees_delivery: boolean
          sort_order: number
          standard_hours_per_day: number
          updated_at: string
        }
        Insert: {
          code: string
          coverage_days_per_week?: number | null
          created_at?: string
          default_days_per_week?: number | null
          default_role?: string | null
          id?: string
          is_active?: boolean
          name_th: string
          ot_eligible?: boolean
          payroll_cycle?: string | null
          schedule_type?: string
          sees_delivery?: boolean
          sort_order?: number
          standard_hours_per_day?: number
          updated_at?: string
        }
        Update: {
          code?: string
          coverage_days_per_week?: number | null
          created_at?: string
          default_days_per_week?: number | null
          default_role?: string | null
          id?: string
          is_active?: boolean
          name_th?: string
          ot_eligible?: boolean
          payroll_cycle?: string | null
          schedule_type?: string
          sees_delivery?: boolean
          sort_order?: number
          standard_hours_per_day?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_functions_payroll_cycle_fkey"
            columns: ["payroll_cycle"]
            isOneToOne: false
            referencedRelation: "payroll_cycles"
            referencedColumns: ["code"]
          },
        ]
      }
      leave_days: {
        Row: {
          counts_toward_quota: boolean
          id: string
          leave_date: string
          leave_request_id: string
          refund_reason: string | null
          refunded_at: string | null
          user_id: string
        }
        Insert: {
          counts_toward_quota?: boolean
          id?: string
          leave_date: string
          leave_request_id: string
          refund_reason?: string | null
          refunded_at?: string | null
          user_id: string
        }
        Update: {
          counts_toward_quota?: boolean
          id?: string
          leave_date?: string
          leave_request_id?: string
          refund_reason?: string | null
          refunded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_days_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_quota_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changes: Json
          id: string
          reason: string
          user_id: string
          year: number
        }
        Insert: {
          changed_at: string
          changed_by?: string | null
          changes: Json
          id?: string
          reason?: string
          user_id: string
          year: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changes?: Json
          id?: string
          reason?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_quota_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_quota_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_quota_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_quota_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_quotas: {
        Row: {
          leave_type: string
          remaining_days: number | null
          total_days: number
          updated_at: string
          updated_by: string | null
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          leave_type: string
          remaining_days?: number | null
          total_days?: number
          updated_at?: string
          updated_by?: string | null
          used_days?: number
          user_id: string
          year: number
        }
        Update: {
          leave_type?: string
          remaining_days?: number | null
          total_days?: number
          updated_at?: string
          updated_by?: string | null
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_quotas_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_quotas_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_quotas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_quotas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachments: string[]
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: string
          reason: string
          rejected_reason: string | null
          start_date: string
          status: string
          total_days: number
          updated_at: string
          urgent_multiplier: number
          user_avatar: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachments?: string[]
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type: string
          reason?: string
          rejected_reason?: string | null
          start_date: string
          status?: string
          total_days: number
          updated_at?: string
          urgent_multiplier?: number
          user_avatar?: string
          user_email?: string
          user_id: string
          user_name?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachments?: string[]
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string
          rejected_reason?: string | null
          start_date?: string
          status?: string
          total_days?: number
          updated_at?: string
          urgent_multiplier?: number
          user_avatar?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_type_defaults: {
        Row: {
          default_days: number
          leave_type: string
          note: string
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          default_days: number
          leave_type: string
          note?: string
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          default_days?: number
          leave_type?: string
          note?: string
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_type_defaults_leave_type_fkey"
            columns: ["leave_type"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leave_type_defaults_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_type_defaults_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          code: string
          is_active: boolean
          name_th: string
          requires_attachment: boolean
          updated_at: string
        }
        Insert: {
          code: string
          is_active?: boolean
          name_th: string
          requires_attachment?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          is_active?: boolean
          name_th?: string
          requires_attachment?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      location_corrections: {
        Row: {
          action: string
          created_at: string
          evidence: string
          firestore_name: string
          merge_into_name: string | null
          new_lat: number | null
          new_lng: number | null
          new_location_type: string | null
          new_radius: number | null
        }
        Insert: {
          action: string
          created_at?: string
          evidence: string
          firestore_name: string
          merge_into_name?: string | null
          new_lat?: number | null
          new_lng?: number | null
          new_location_type?: string | null
          new_radius?: number | null
        }
        Update: {
          action?: string
          created_at?: string
          evidence?: string
          firestore_name?: string
          merge_into_name?: string | null
          new_lat?: number | null
          new_lng?: number | null
          new_location_type?: string | null
          new_radius?: number | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string
          break_hours: number
          created_at: string
          id: string
          is_active: boolean
          lat: number
          lng: number
          location_type: string
          name: string
          open_to_all: boolean
          owner_user_id: string | null
          radius: number
          updated_at: string
          working_hours: Json
        }
        Insert: {
          address?: string
          break_hours?: number
          created_at?: string
          id?: string
          is_active?: boolean
          lat: number
          lng: number
          location_type?: string
          name: string
          open_to_all?: boolean
          owner_user_id?: string | null
          radius?: number
          updated_at?: string
          working_hours?: Json
        }
        Update: {
          address?: string
          break_hours?: number
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number
          lng?: number
          location_type?: string
          name?: string
          open_to_all?: boolean
          owner_user_id?: string | null
          radius?: number
          updated_at?: string
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "locations_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_id_map: {
        Row: {
          collection: string
          firestore_id: string
          migrated_at: string
          postgres_id: string
        }
        Insert: {
          collection: string
          firestore_id: string
          migrated_at?: string
          postgres_id: string
        }
        Update: {
          collection?: string
          firestore_id?: string
          migrated_at?: string
          postgres_id?: string
        }
        Relationships: []
      }
      ot_rate_settings: {
        Row: {
          company_id: string
          label_th: string
          legal_min: number
          multiplier: number
          situation: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          label_th: string
          legal_min: number
          multiplier: number
          situation: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          label_th?: string
          legal_min?: number
          multiplier?: number
          situation?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ot_rate_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_rate_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_rate_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_cycles: {
        Row: {
          code: string
          is_active: boolean
          name_th: string
          note: string | null
          pay_day: number
          pays_at_period_end: boolean
          period_start_day: number
        }
        Insert: {
          code: string
          is_active?: boolean
          name_th: string
          note?: string | null
          pay_day: number
          pays_at_period_end?: boolean
          period_start_day: number
        }
        Update: {
          code?: string
          is_active?: boolean
          name_th?: string
          note?: string | null
          pay_day?: number
          pays_at_period_end?: boolean
          period_start_day?: number
        }
        Relationships: []
      }
      payroll_entries: {
        Row: {
          absent_days: number
          base_salary: number
          commission: number
          company_id: string | null
          deduction: number
          extra: number
          id: string
          month: string
          note: string
          ot_hours: number
          ot_rate: number
          total: number | null
          updated_at: string
          updated_by: string | null
          user_id: string
          variable_inputs: Json | null
          work_days: number
        }
        Insert: {
          absent_days?: number
          base_salary?: number
          commission?: number
          company_id?: string | null
          deduction?: number
          extra?: number
          id?: string
          month: string
          note?: string
          ot_hours?: number
          ot_rate?: number
          total?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          variable_inputs?: Json | null
          work_days?: number
        }
        Update: {
          absent_days?: number
          base_salary?: number
          commission?: number
          company_id?: string | null
          deduction?: number
          extra?: number
          id?: string
          month?: string
          note?: string
          ot_hours?: number
          ot_rate?: number
          total?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          variable_inputs?: Json | null
          work_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batch_bottles: {
        Row: {
          batch_id: string
          count: number
          id: string
          label: string
          ml: number
        }
        Insert: {
          batch_id: string
          count: number
          id?: string
          label: string
          ml: number
        }
        Update: {
          batch_id?: string
          count?: number
          id?: string
          label?: string
          ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_batch_bottles_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batch_items: {
        Row: {
          actual_qty: number
          batch_id: string
          id: string
          is_yield_base: boolean
          name: string
          planned_qty: number
          sort_order: number
          unit: string
        }
        Insert: {
          actual_qty: number
          batch_id: string
          id?: string
          is_yield_base?: boolean
          name: string
          planned_qty: number
          sort_order?: number
          unit: string
        }
        Update: {
          actual_qty?: number
          batch_id?: string
          id?: string
          is_yield_base?: boolean
          name?: string
          planned_qty?: number
          sort_order?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          batch_date: string
          created_at: string
          id: string
          juice_brix: number | null
          juice_liters: number | null
          liters_planned: number
          made_by: string | null
          note: string
          output_ml: number
          recipe_id: string | null
          recipe_name: string
          yield_base_kg: number | null
          yield_percent: number | null
        }
        Insert: {
          batch_date: string
          created_at?: string
          id?: string
          juice_brix?: number | null
          juice_liters?: number | null
          liters_planned: number
          made_by?: string | null
          note?: string
          output_ml?: number
          recipe_id?: string | null
          recipe_name: string
          yield_base_kg?: number | null
          yield_percent?: number | null
        }
        Update: {
          batch_date?: string
          created_at?: string
          id?: string
          juice_brix?: number | null
          juice_liters?: number | null
          liters_planned?: number
          made_by?: string | null
          note?: string
          output_ml?: number
          recipe_id?: string | null
          recipe_name?: string
          yield_base_kg?: number | null
          yield_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_made_by_fkey"
            columns: ["made_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_made_by_fkey"
            columns: ["made_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "production_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_bottle_sizes: {
        Row: {
          id: string
          is_active: boolean
          label: string
          ml: number
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          label: string
          ml: number
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          label?: string
          ml?: number
          sort_order?: number
        }
        Relationships: []
      }
      production_recipe_items: {
        Row: {
          id: string
          is_yield_base: boolean
          name: string
          qty_per_liter: number
          recipe_id: string
          sort_order: number
          unit: string
        }
        Insert: {
          id?: string
          is_yield_base?: boolean
          name: string
          qty_per_liter: number
          recipe_id: string
          sort_order?: number
          unit?: string
        }
        Update: {
          id?: string
          is_yield_base?: boolean
          name?: string
          qty_per_liter?: number
          recipe_id?: string
          sort_order?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "production_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_recipes: {
        Row: {
          created_at: string
          id: string
          image: string
          is_active: boolean
          juice_ratio: number
          name: string
          note: string
          recipe_type: string
          sort_order: number
          steps: string
          syrup_brix: number
          target_brix: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image?: string
          is_active?: boolean
          juice_ratio?: number
          name: string
          note?: string
          recipe_type?: string
          sort_order?: number
          steps?: string
          syrup_brix?: number
          target_brix?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image?: string
          is_active?: boolean
          juice_ratio?: number
          name?: string
          note?: string
          recipe_type?: string
          sort_order?: number
          steps?: string
          syrup_brix?: number
          target_brix?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_recipes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_recipes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_read_all: boolean
          can_read_own: boolean
          can_write_all: boolean
          can_write_own: boolean
          note: string
          resource: string
          role: string
        }
        Insert: {
          can_read_all?: boolean
          can_read_own?: boolean
          can_write_all?: boolean
          can_write_own?: boolean
          note?: string
          resource: string
          role: string
        }
        Update: {
          can_read_all?: boolean
          can_read_own?: boolean
          can_write_all?: boolean
          can_write_own?: boolean
          note?: string
          resource?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "role_settings"
            referencedColumns: ["role"]
          },
        ]
      }
      role_settings: {
        Row: {
          label_th: string
          rank: number
          requires_checkin: boolean
          role: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          label_th: string
          rank?: number
          requires_checkin?: boolean
          role: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          label_th?: string
          rank?: number
          requires_checkin?: boolean
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          exception_date: string
          id: string
          note: string
          user_id: string
          work_mode: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          exception_date: string
          id?: string
          note?: string
          user_id: string
          work_mode: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          exception_date?: string
          id?: string
          note?: string
          user_id?: string
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          end_time: string
          grace_minutes: number
          id: string
          location_id: string
          name: string
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          grace_minutes?: number
          id?: string
          location_id: string
          name: string
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          grace_minutes?: number
          id?: string
          location_id?: string
          name?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_channels: {
        Row: {
          follower_count: number
          id: string
          influencer_id: string
          is_verified: boolean
          platform: string
          profile_url: string
          username: string
        }
        Insert: {
          follower_count?: number
          id?: string
          influencer_id: string
          is_verified?: boolean
          platform: string
          profile_url?: string
          username?: string
        }
        Update: {
          follower_count?: number
          id?: string
          influencer_id?: string
          is_verified?: boolean
          platform?: string
          profile_url?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_channels_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      srp_brand_access: {
        Row: {
          brand_id: string
          created_at: string
          granted_by: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "srp_brand_access_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "srp_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "srp_brand_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "srp_brand_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "srp_brand_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "srp_brand_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      srp_brand_channels: {
        Row: {
          brand_id: string
          commission_pct: number
          created_at: string
          dc_pct: number
          gp_pct: number
          id: string
          name: string
          pc_pct: number
          promo_pct: number
          service_fee_pct: number
          shipping_thb: number
          sort_order: number
          transaction_fee_pct: number
          type: string
        }
        Insert: {
          brand_id: string
          commission_pct?: number
          created_at?: string
          dc_pct?: number
          gp_pct?: number
          id?: string
          name: string
          pc_pct?: number
          promo_pct?: number
          service_fee_pct?: number
          shipping_thb?: number
          sort_order?: number
          transaction_fee_pct?: number
          type: string
        }
        Update: {
          brand_id?: string
          commission_pct?: number
          created_at?: string
          dc_pct?: number
          gp_pct?: number
          id?: string
          name?: string
          pc_pct?: number
          promo_pct?: number
          service_fee_pct?: number
          shipping_thb?: number
          sort_order?: number
          transaction_fee_pct?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "srp_brand_channels_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "srp_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      srp_brands: {
        Row: {
          created_at: string
          default_multiplier: number
          eur_to_thb: number
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          platform_markup_pct: number
          updated_at: string
          usd_to_thb: number
          vat: number
        }
        Insert: {
          created_at?: string
          default_multiplier?: number
          eur_to_thb?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          platform_markup_pct?: number
          updated_at?: string
          usd_to_thb?: number
          vat?: number
        }
        Update: {
          created_at?: string
          default_multiplier?: number
          eur_to_thb?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          platform_markup_pct?: number
          updated_at?: string
          usd_to_thb?: number
          vat?: number
        }
        Relationships: []
      }
      srp_products: {
        Row: {
          brand_id: string
          category: string
          created_at: string
          fob_eur: number
          fob_usd: number
          freight_do: number
          id: string
          image_url: string
          import_tax_pct: number
          is_active: boolean
          last_edited_at: string | null
          last_edited_by: string
          multiplier: number
          name: string
          notes: string
          our_price_thb: number
          platform_price_thb: number
          shipping_cost: number
          sku: string
          sort_order: number
          srp_eur: number
          srp_usd: number
        }
        Insert: {
          brand_id: string
          category?: string
          created_at?: string
          fob_eur?: number
          fob_usd?: number
          freight_do?: number
          id?: string
          image_url?: string
          import_tax_pct?: number
          is_active?: boolean
          last_edited_at?: string | null
          last_edited_by?: string
          multiplier?: number
          name?: string
          notes?: string
          our_price_thb?: number
          platform_price_thb?: number
          shipping_cost?: number
          sku?: string
          sort_order?: number
          srp_eur?: number
          srp_usd?: number
        }
        Update: {
          brand_id?: string
          category?: string
          created_at?: string
          fob_eur?: number
          fob_usd?: number
          freight_do?: number
          id?: string
          image_url?: string
          import_tax_pct?: number
          is_active?: boolean
          last_edited_at?: string | null
          last_edited_by?: string
          multiplier?: number
          name?: string
          notes?: string
          our_price_thb?: number
          platform_price_thb?: number
          shipping_cost?: number
          sku?: string
          sort_order?: number
          srp_eur?: number
          srp_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "srp_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "srp_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          campaign_id: string
          campaign_name: string
          code: string
          created_at: string
          id: string
          influencer_id: string
          influencer_name: string
          is_draft: boolean
          last_saved_at: string | null
          status: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          campaign_name?: string
          code: string
          created_at?: string
          id?: string
          influencer_id: string
          influencer_name?: string
          is_draft?: boolean
          last_saved_at?: string | null
          status?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string
          code?: string
          created_at?: string
          id?: string
          influencer_id?: string
          influencer_name?: string
          is_draft?: boolean
          last_saved_at?: string | null
          status?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      submitted_links: {
        Row: {
          added_at: string
          id: string
          platform: string
          submission_id: string
          url: string
        }
        Insert: {
          added_at?: string
          id?: string
          platform: string
          submission_id: string
          url: string
        }
        Update: {
          added_at?: string
          id?: string
          platform?: string
          submission_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "submitted_links_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_allowed_locations: {
        Row: {
          location_id: string
          user_id: string
        }
        Insert: {
          location_id: string
          user_id: string
        }
        Update: {
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_allowed_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_allowed_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_allowed_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_compensation: {
        Row: {
          base_salary: number
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          note: string
          pay_type: string
          user_id: string
        }
        Insert: {
          base_salary: number
          created_at?: string
          created_by?: string | null
          effective_from: string
          id?: string
          note?: string
          pay_type?: string
          user_id: string
        }
        Update: {
          base_salary?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          note?: string
          pay_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_compensation_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compensation_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compensation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compensation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pay_items: {
        Row: {
          amount: number
          calc: string
          company_id: string | null
          config: Json | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          frequency: string
          id: string
          kind: string
          label: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          calc?: string
          company_id?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          frequency?: string
          id?: string
          kind?: string
          label: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          calc?: string
          company_id?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          frequency?: string
          id?: string
          kind?: string
          label?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pay_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pay_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pay_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pay_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pay_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_read_all: boolean
          can_read_own: boolean
          can_write_all: boolean
          can_write_own: boolean
          created_at: string
          granted_by: string | null
          reason: string
          resource: string
          user_id: string
        }
        Insert: {
          can_read_all?: boolean
          can_read_own?: boolean
          can_write_all?: boolean
          can_write_own?: boolean
          created_at?: string
          granted_by?: string | null
          reason?: string
          resource: string
          user_id: string
        }
        Update: {
          can_read_all?: boolean
          can_read_own?: boolean
          can_write_all?: boolean
          can_write_own?: boolean
          created_at?: string
          granted_by?: string | null
          reason?: string
          resource?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_remarks: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          remark: string
          remark_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          remark: string
          remark_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          remark?: string
          remark_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_remarks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_remarks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_remarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_remarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings_plan: {
        Row: {
          applied_at: string | null
          employment_type: string | null
          full_name_hint: string | null
          match_line_display_name: string
          nickname: string
          note: string
          requires_checkin: boolean | null
          set_role: string | null
          wfh_eligible: boolean | null
        }
        Insert: {
          applied_at?: string | null
          employment_type?: string | null
          full_name_hint?: string | null
          match_line_display_name: string
          nickname: string
          note?: string
          requires_checkin?: boolean | null
          set_role?: string | null
          wfh_eligible?: boolean | null
        }
        Update: {
          applied_at?: string | null
          employment_type?: string | null
          full_name_hint?: string | null
          match_line_display_name?: string
          nickname?: string
          note?: string
          requires_checkin?: boolean | null
          set_role?: string | null
          wfh_eligible?: boolean | null
        }
        Relationships: []
      }
      user_work_schedules: {
        Row: {
          day_of_week: number
          note: string
          user_id: string
          work_mode: string
        }
        Insert: {
          day_of_week: number
          note?: string
          user_id: string
          work_mode: string
        }
        Update: {
          day_of_week?: number
          note?: string
          user_id?: string
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_work_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_work_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          allow_checkin_outside_location: boolean
          approved_at: string | null
          approved_by: string | null
          bank_account_no: string | null
          bank_name: string | null
          birth_date: string | null
          company_id: string | null
          created_at: string
          days_per_week: number | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_name: string | null
          discord_user_id: string | null
          discord_username: string | null
          display_name: string | null
          employee_code: number | null
          employment_status: string
          employment_type: string
          end_date: string | null
          end_reason: string | null
          full_name: string
          home_lat: number | null
          home_lng: number | null
          home_radius: number
          id: string
          invite_link_code: string | null
          invite_link_id: string | null
          is_active: boolean
          is_system: boolean
          job_function_id: string | null
          last_login_at: string | null
          line_display_name: string
          line_picture_url: string
          line_user_id: string
          name_verified: boolean
          national_id: string | null
          needs_approval: boolean
          nickname: string | null
          ot_eligible: boolean | null
          payroll_cycle: string | null
          phone: string
          photo_url: string | null
          primary_location_id: string | null
          probation_end_date: string | null
          registered_at: string
          requires_checkin: boolean | null
          role: string
          start_date: string | null
          start_date_verified: boolean
          updated_at: string
          wfh_eligible: boolean
        }
        Insert: {
          address?: string | null
          allow_checkin_outside_location?: boolean
          approved_at?: string | null
          approved_by?: string | null
          bank_account_no?: string | null
          bank_name?: string | null
          birth_date?: string | null
          company_id?: string | null
          created_at?: string
          days_per_week?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          discord_user_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          employee_code?: number | null
          employment_status?: string
          employment_type?: string
          end_date?: string | null
          end_reason?: string | null
          full_name: string
          home_lat?: number | null
          home_lng?: number | null
          home_radius?: number
          id: string
          invite_link_code?: string | null
          invite_link_id?: string | null
          is_active?: boolean
          is_system?: boolean
          job_function_id?: string | null
          last_login_at?: string | null
          line_display_name?: string
          line_picture_url?: string
          line_user_id: string
          name_verified?: boolean
          national_id?: string | null
          needs_approval?: boolean
          nickname?: string | null
          ot_eligible?: boolean | null
          payroll_cycle?: string | null
          phone?: string
          photo_url?: string | null
          primary_location_id?: string | null
          probation_end_date?: string | null
          registered_at?: string
          requires_checkin?: boolean | null
          role?: string
          start_date?: string | null
          start_date_verified?: boolean
          updated_at?: string
          wfh_eligible?: boolean
        }
        Update: {
          address?: string | null
          allow_checkin_outside_location?: boolean
          approved_at?: string | null
          approved_by?: string | null
          bank_account_no?: string | null
          bank_name?: string | null
          birth_date?: string | null
          company_id?: string | null
          created_at?: string
          days_per_week?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          discord_user_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          employee_code?: number | null
          employment_status?: string
          employment_type?: string
          end_date?: string | null
          end_reason?: string | null
          full_name?: string
          home_lat?: number | null
          home_lng?: number | null
          home_radius?: number
          id?: string
          invite_link_code?: string | null
          invite_link_id?: string | null
          is_active?: boolean
          is_system?: boolean
          job_function_id?: string | null
          last_login_at?: string | null
          line_display_name?: string
          line_picture_url?: string
          line_user_id?: string
          name_verified?: boolean
          national_id?: string | null
          needs_approval?: boolean
          nickname?: string | null
          ot_eligible?: boolean | null
          payroll_cycle?: string | null
          phone?: string
          photo_url?: string | null
          primary_location_id?: string | null
          probation_end_date?: string | null
          registered_at?: string
          requires_checkin?: boolean | null
          role?: string
          start_date?: string | null
          start_date_verified?: boolean
          updated_at?: string
          wfh_eligible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "users_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_invite_link_fk"
            columns: ["invite_link_id"]
            isOneToOne: false
            referencedRelation: "invite_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_payroll_cycle_fkey"
            columns: ["payroll_cycle"]
            isOneToOne: false
            referencedRelation: "payroll_cycles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "users_primary_location_id_fkey"
            columns: ["primary_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      web_bills: {
        Row: {
          bill_domain: boolean
          course_id: string | null
          created_at: string
          domain_amount: number
          hosting_amount: number
          id: string
          paid_at: string | null
          paid_scope: string
          period_end: string | null
          period_start: string | null
          renewed_registrar: string | null
          site_id: string
          status: string
          year: number
        }
        Insert: {
          bill_domain?: boolean
          course_id?: string | null
          created_at?: string
          domain_amount?: number
          hosting_amount?: number
          id?: string
          paid_at?: string | null
          paid_scope?: string
          period_end?: string | null
          period_start?: string | null
          renewed_registrar?: string | null
          site_id: string
          status?: string
          year: number
        }
        Update: {
          bill_domain?: boolean
          course_id?: string | null
          created_at?: string
          domain_amount?: number
          hosting_amount?: number
          id?: string
          paid_at?: string | null
          paid_scope?: string
          period_end?: string | null
          period_start?: string | null
          renewed_registrar?: string | null
          site_id?: string
          status?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "web_bills_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "web_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_bills_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "web_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      web_host_secrets: {
        Row: {
          host_id: string
          ssh_password: string | null
          ssh_private_key: string | null
          ssh_passphrase: string | null
          updated_at: string
        }
        Insert: {
          host_id: string
          ssh_password?: string | null
          ssh_private_key?: string | null
          ssh_passphrase?: string | null
          updated_at?: string
        }
        Update: {
          host_id?: string
          ssh_password?: string | null
          ssh_private_key?: string | null
          ssh_passphrase?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_host_secrets_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: true
            referencedRelation: "web_hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      web_ssh_keys: {
        Row: {
          created_at: string
          id: string
          name: string
          passphrase: string | null
          private_key: string
          provider: string
          public_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          passphrase?: string | null
          private_key: string
          provider?: string
          public_key?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          passphrase?: string | null
          private_key?: string
          provider?: string
          public_key?: string
        }
        Relationships: []
      }
      web_hosts: {
        Row: {
          backup_keep: number
          created_at: string
          domains_path: string
          hardened: boolean
          has_password: boolean
          is_own_business: boolean
          plan_expires_at: string | null
          has_key: boolean
          id: string
          key_id: string | null
          is_active: boolean
          last_discovered_at: string | null
          name: string
          notes: string | null
          provider: string
          ssh_host: string
          ssh_port: number
          ssh_user: string
        }
        Insert: {
          backup_keep?: number
          created_at?: string
          domains_path?: string
          hardened?: boolean
          has_password?: boolean
          is_own_business?: boolean
          plan_expires_at?: string | null
          has_key?: boolean
          id?: string
          key_id?: string | null
          is_active?: boolean
          last_discovered_at?: string | null
          name: string
          notes?: string | null
          provider?: string
          ssh_host: string
          ssh_port?: number
          ssh_user: string
        }
        Update: {
          backup_keep?: number
          created_at?: string
          domains_path?: string
          hardened?: boolean
          has_password?: boolean
          is_own_business?: boolean
          plan_expires_at?: string | null
          has_key?: boolean
          id?: string
          key_id?: string | null
          is_active?: boolean
          last_discovered_at?: string | null
          name?: string
          notes?: string | null
          provider?: string
          ssh_host?: string
          ssh_port?: number
          ssh_user?: string
        }
        Relationships: []
      }
      web_jobs: {
        Row: {
          attempts: number
          batch_id: string | null
          finished_at: string | null
          force: boolean
          host_id: string | null
          id: string
          queued_at: string
          raw_log: string | null
          site_id: string | null
          started_at: string | null
          status: string
          summary: Json | null
          triggered_by: string
          type: string
        }
        Insert: {
          attempts?: number
          batch_id?: string | null
          finished_at?: string | null
          force?: boolean
          host_id?: string | null
          id?: string
          queued_at?: string
          raw_log?: string | null
          site_id?: string | null
          started_at?: string | null
          status?: string
          summary?: Json | null
          triggered_by?: string
          type: string
        }
        Update: {
          attempts?: number
          batch_id?: string | null
          finished_at?: string | null
          force?: boolean
          host_id?: string | null
          id?: string
          queued_at?: string
          raw_log?: string | null
          site_id?: string | null
          started_at?: string | null
          status?: string
          summary?: Json | null
          triggered_by?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "web_run_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_jobs_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "web_hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_jobs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "web_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      web_run_batches: {
        Row: {
          created_at: string
          created_by: string | null
          done_jobs: number
          failed_jobs: number
          finished_at: string | null
          id: string
          total_jobs: number
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done_jobs?: number
          failed_jobs?: number
          finished_at?: string | null
          id?: string
          total_jobs?: number
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done_jobs?: number
          failed_jobs?: number
          finished_at?: string | null
          id?: string
          total_jobs?: number
          type?: string
        }
        Relationships: []
      }
      web_false_positives: {
        Row: {
          created_at: string
          description: string
          id: string
          path_pattern: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          path_pattern: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          path_pattern?: string
        }
        Relationships: []
      }
      web_courses: {
        Row: {
          created_at: string
          domain_amount: number
          hosting_amount: number
          id: string
          name: string
          period_end: string | null
          period_start: string | null
        }
        Insert: {
          created_at?: string
          domain_amount?: number
          hosting_amount?: number
          id?: string
          name: string
          period_end?: string | null
          period_start?: string | null
        }
        Update: {
          created_at?: string
          domain_amount?: number
          hosting_amount?: number
          id?: string
          name?: string
          period_end?: string | null
          period_start?: string | null
        }
        Relationships: []
      }
      web_owners: {
        Row: {
          added_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_owners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      web_plugin_blocks: {
        Row: {
          created_at: string
          fails: number
          id: string
          last_error: string | null
          last_tried_at: string | null
          name: string
          site_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          fails?: number
          id?: string
          last_error?: string | null
          last_tried_at?: string | null
          name?: string
          site_id: string
          slug: string
        }
        Update: {
          created_at?: string
          fails?: number
          id?: string
          last_error?: string | null
          last_tried_at?: string | null
          name?: string
          site_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_plugin_blocks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "web_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      web_plugins: {
        Row: {
          checked_at: string
          id: string
          name: string
          new_version: string | null
          site_id: string
          slug: string
          status: string
          version: string
        }
        Insert: {
          checked_at?: string
          id?: string
          name?: string
          new_version?: string | null
          site_id: string
          slug: string
          status?: string
          version?: string
        }
        Update: {
          checked_at?: string
          id?: string
          name?: string
          new_version?: string | null
          site_id?: string
          slug?: string
          status?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_plugins_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "web_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      web_site_logs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          message: string
          site_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          message?: string
          site_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          message?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_site_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_site_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "web_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      web_sites: {
        Row: {
          course_id: string | null
          created_at: string
          domain_expires_at: string | null
          domain_registered_at: string | null
          domain_registrar: string | null
          domain_self_registered: boolean
          down_since: string | null
          page_issue: string | null
          hosting_account: string | null
          hosting_expires_at: string | null
          hosting_provider: string | null
          host_id: string | null
          is_own_business: boolean
          last_backup_at: string | null
          last_backup_file: string | null
          last_scan_at: string | null
          last_scan_status: string
          pending_plugin_count: number
          blocked_plugin_count: number
          plugin_count: number
          public_html_path: string | null
          http_status: number | null
          id: string
          is_active: boolean
          last_checked_at: string | null
          last_up_at: string | null
          notes: string | null
          plugins_checked_at: string | null
          response_ms: number | null
          site_name: string
          ssh_host: string | null
          ssh_path: string | null
          ssh_port: number
          ssh_user: string | null
          ssl_expires_at: string | null
          student_contact: string | null
          student_name: string | null
          updated_at: string
          wp_admin_url: string | null
          wp_version: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          domain_expires_at?: string | null
          domain_registered_at?: string | null
          domain_registrar?: string | null
          domain_self_registered?: boolean
          down_since?: string | null
          page_issue?: string | null
          hosting_account?: string | null
          hosting_expires_at?: string | null
          hosting_provider?: string | null
          host_id?: string | null
          is_own_business?: boolean
          last_backup_at?: string | null
          last_backup_file?: string | null
          last_scan_at?: string | null
          last_scan_status?: string
          pending_plugin_count?: number
          blocked_plugin_count?: number
          plugin_count?: number
          public_html_path?: string | null
          http_status?: number | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_up_at?: string | null
          notes?: string | null
          plugins_checked_at?: string | null
          response_ms?: number | null
          site_name: string
          ssh_host?: string | null
          ssh_path?: string | null
          ssh_port?: number
          ssh_user?: string | null
          ssl_expires_at?: string | null
          student_contact?: string | null
          student_name?: string | null
          updated_at?: string
          wp_admin_url?: string | null
          wp_version?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          domain_expires_at?: string | null
          domain_registered_at?: string | null
          domain_registrar?: string | null
          domain_self_registered?: boolean
          down_since?: string | null
          page_issue?: string | null
          hosting_account?: string | null
          hosting_expires_at?: string | null
          hosting_provider?: string | null
          host_id?: string | null
          is_own_business?: boolean
          last_backup_at?: string | null
          last_backup_file?: string | null
          last_scan_at?: string | null
          last_scan_status?: string
          pending_plugin_count?: number
          blocked_plugin_count?: number
          plugin_count?: number
          public_html_path?: string | null
          http_status?: number | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_up_at?: string | null
          notes?: string | null
          plugins_checked_at?: string | null
          response_ms?: number | null
          site_name?: string
          ssh_host?: string | null
          ssh_path?: string | null
          ssh_port?: number
          ssh_user?: string | null
          ssl_expires_at?: string | null
          student_contact?: string | null
          student_name?: string | null
          updated_at?: string
          wp_admin_url?: string | null
          wp_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_sites_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "web_hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_sites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "web_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      web_slips: {
        Row: {
          bill_id: string
          id: string
          qr_raw: string | null
          read_ref: string | null
          site_id: string
          slip_image_url: string
          uploaded_at: string
          verify_result: string
        }
        Insert: {
          bill_id: string
          id?: string
          qr_raw?: string | null
          read_ref?: string | null
          site_id: string
          slip_image_url: string
          uploaded_at?: string
          verify_result?: string
        }
        Update: {
          bill_id?: string
          id?: string
          qr_raw?: string | null
          read_ref?: string | null
          site_id?: string
          slip_image_url?: string
          uploaded_at?: string
          verify_result?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_slips_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "web_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_slips_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "web_sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employee_directory: {
        Row: {
          company_code: string | null
          company_name: string | null
          days_per_week: number | null
          employment_status: string | null
          employment_type: string | null
          end_date: string | null
          end_reason: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          job_function: string | null
          location_name: string | null
          months_of_service: number | null
          nickname: string | null
          requires_checkin: boolean | null
          role: string | null
          role_th: string | null
          start_date: string | null
          start_date_verified: boolean | null
          vacation_eligible: boolean | null
          wfh_eligible: boolean | null
          years_of_service: number | null
        }
        Relationships: []
      }
      salary_history: {
        Row: {
          base_salary: number | null
          change_amount: number | null
          change_percent: number | null
          effective_from: string | null
          full_name: string | null
          note: string | null
          pay_type: string | null
          previous_salary: number | null
          recorded_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_compensation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compensation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      attendance_period_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          avg_hours_per_day: number
          business_unit: string
          company_code: string
          days_absent: number
          days_expected: number
          days_leave: number
          days_per_week: number
          days_worked: number
          employment_type: string
          full_name: string
          total_hours: number
        }[]
      }
      attendance_report: {
        Args: {
          p_from: string
          p_limit?: number
          p_location_id?: string
          p_offset?: number
          p_only_present?: boolean
          p_to: string
          p_user_ids?: string[]
        }
        Returns: {
          checkin_type: string
          first_in: string
          full_name: string
          holiday_name: string
          is_late: boolean
          is_working_holiday: boolean
          last_out: string
          late_minutes: number
          leave_type: string
          location_name: string
          status: string
          total_count: number
          total_hours: number
          user_id: string
          work_date: string
        }[]
      }
      attendance_report_json: {
        Args: {
          p_from: string
          p_location_id?: string
          p_only_present?: boolean
          p_to: string
          p_user_ids?: string[]
        }
        Returns: Json
      }
      attendance_summary: {
        Args: { p_from: string; p_to: string; p_user_id?: string }
        Returns: {
          business_unit: string
          checkin_type: string
          company_code: string
          expected_mode: string
          full_name: string
          is_late: boolean
          leave_type: string
          status: string
          total_hours: number
          user_id: string
          work_date: string
        }[]
      }
      auth_role: { Args: never; Returns: string }
      can_checkin_at: {
        Args: { p_location_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_all: { Args: never; Returns: boolean }
      clamp_day: {
        Args: { p_day: number; p_month_start: string }
        Returns: string
      }
      consume_invite_link: {
        Args: { p_code: string }
        Returns: {
          allow_checkin_outside_location: boolean
          default_location_ids: string[]
          default_role: string
          id: string
          require_approval: boolean
        }[]
      }
      effective_permission: {
        Args: { p_resource: string; p_user_id: string }
        Returns: {
          can_read_all: boolean
          can_read_own: boolean
          can_write_all: boolean
          can_write_own: boolean
          source: string
        }[]
      }
      expand_leave_days: { Args: { p_request_id: string }; Returns: undefined }
      expected_work_mode: {
        Args: { p_date: string; p_user_id: string }
        Returns: string
      }
      hourly_rate: {
        Args: { p_date: string; p_user_id: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_web_owner: { Args: never; Returns: boolean }
      web_claim_jobs: {
        Args: { p_limit?: number }
        Returns: Database["public"]["Tables"]["web_jobs"]["Row"][]
      }
      is_hr: { Args: never; Returns: boolean }
      is_production_staff: { Args: never; Returns: boolean }
      months_of_service: { Args: { p_start: string }; Returns: number }
      pay_items_total: {
        Args: { p_date: string; p_user_id: string }
        Returns: number
      }
      payroll_period: {
        Args: { p_cycle: string; p_pay_month: string }
        Returns: {
          pay_date: string
          period_end: string
          period_start: string
        }[]
      }
      peek_invite_link: {
        Args: { p_code: string }
        Returns: {
          allow_checkin_outside_location: boolean
          code: string
          default_location_ids: string[]
          default_role: string
          expires_at: string
          id: string
          is_active: boolean
          max_uses: number
          require_approval: boolean
          used_count: number
        }[]
      }
      recalc_delivery_route: {
        Args: { p_date: string; p_driver_id: string }
        Returns: undefined
      }
      recalc_leave_quota: {
        Args: { p_leave_type: string; p_user_id: string; p_year: number }
        Returns: undefined
      }
      seed_leave_quota: {
        Args: { p_user_id: string; p_year: number }
        Returns: number
      }
      srp_role: { Args: { b_id: string }; Returns: string }
      sum_total_hours: {
        Args: never
        Returns: {
          needs_review: number
          recomputed: number
          rows: number
          total_hours: number
        }[]
      }
      user_requires_checkin: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
