
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "condition_presets": {
                  Row: {
                    "config": NonNullable<Json>,"is_available": boolean,"key": string,"name": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "config"?: NonNullable<Json>,"is_available"?: boolean,"key": string,"name": string,"version"?: number
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"is_available"?: boolean,"key"?: string,"name"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"dose_events": {
                  Row: {
                    "amount": number | null,"created_at": string,"given_at": string,"id": string,"inventory_decremented": number,"logged_by": string | null,"medication_id": string,"medication_version_id": string | null,"note": string | null,"outcome": Database["public"]['Enums']["dose_outcome"],"pet_id": string,"scheduled_for": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number | null,"created_at"?: string,"given_at"?: string,"id": string,"inventory_decremented"?: number,"logged_by"?: string | null,"medication_id": string,"medication_version_id"?: string | null,"note"?: string | null,"outcome": Database["public"]['Enums']["dose_outcome"],"pet_id": string,"scheduled_for"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount"?: number | null,"created_at"?: string,"given_at"?: string,"id"?: string,"inventory_decremented"?: number,"logged_by"?: string | null,"medication_id"?: string,"medication_version_id"?: string | null,"note"?: string | null,"outcome"?: Database["public"]['Enums']["dose_outcome"],"pet_id"?: string,"scheduled_for"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "dose_events_medication_id_fkey"
      columns: ["medication_id"]
isOneToOne: false
      referencedRelation: "medications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dose_events_medication_version_id_fkey"
      columns: ["medication_version_id"]
isOneToOne: false
      referencedRelation: "medication_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dose_events_pet_id_fkey"
      columns: ["pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    }
                  ]
                },"feeding_events": {
                  Row: {
                    "created_at": string,"food": string | null,"id": string,"logged_at": string,"logged_by": string | null,"meal_schedule_id": string | null,"note": string | null,"pet_id": string,"portion_eaten": number,"scheduled_for": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"food"?: string | null,"id": string,"logged_at"?: string,"logged_by"?: string | null,"meal_schedule_id"?: string | null,"note"?: string | null,"pet_id": string,"portion_eaten": number,"scheduled_for"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"food"?: string | null,"id"?: string,"logged_at"?: string,"logged_by"?: string | null,"meal_schedule_id"?: string | null,"note"?: string | null,"pet_id"?: string,"portion_eaten"?: number,"scheduled_for"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "feeding_events_meal_schedule_id_fkey"
      columns: ["meal_schedule_id"]
isOneToOne: false
      referencedRelation: "meal_schedules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feeding_events_pet_id_fkey"
      columns: ["pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    }
                  ]
                },"handoff_notes": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"id": string,"pet_id": string,"resolved_at": string | null,"resolved_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"pet_id": string,"resolved_at"?: string | null,"resolved_by"?: string | null
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"pet_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "handoff_notes_pet_id_fkey"
      columns: ["pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    }
                  ]
                },"household_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"created_by": string | null,"expires_at": string,"household_id": string,"id": string,"role": Database["public"]['Enums']["member_role"],"sitter_access_until": string | null,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"household_id": string,"id"?: string,"role": Database["public"]['Enums']["member_role"],"sitter_access_until"?: string | null,"token"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"household_id"?: string,"id"?: string,"role"?: Database["public"]['Enums']["member_role"],"sitter_access_until"?: string | null,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_invites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "added_at": string,"expires_at": string | null,"household_id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"expires_at"?: string | null,"household_id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  Update: {
                    "added_at"?: string,"expires_at"?: string | null,"household_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"timezone"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"meal_schedules": {
                  Row: {
                    "active": boolean,"amount_text": string | null,"created_at": string,"food": string | null,"id": string,"pet_id": string,"time_of_day": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"amount_text"?: string | null,"created_at"?: string,"food"?: string | null,"id"?: string,"pet_id": string,"time_of_day": string
                  }
                  Update: {
                    "active"?: boolean,"amount_text"?: string | null,"created_at"?: string,"food"?: string | null,"id"?: string,"pet_id"?: string,"time_of_day"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_schedules_pet_id_fkey"
      columns: ["pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    }
                  ]
                },"med_schedules": {
                  Row: {
                    "active": boolean,"created_at": string,"days_of_week": (number)[],"id": string,"medication_id": string,"time_of_day": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"days_of_week"?: (number)[],"id"?: string,"medication_id": string,"time_of_day": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"days_of_week"?: (number)[],"id"?: string,"medication_id"?: string,"time_of_day"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "med_schedules_medication_id_fkey"
      columns: ["medication_id"]
isOneToOne: false
      referencedRelation: "medications"
      referencedColumns: ["id"]
    }
                  ]
                },"medication_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"dose_amount": number,"effective_from": string,"effective_to": string | null,"id": string,"instructions": string | null,"medication_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"dose_amount": number,"effective_from"?: string,"effective_to"?: string | null,"id"?: string,"instructions"?: string | null,"medication_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"dose_amount"?: number,"effective_from"?: string,"effective_to"?: string | null,"id"?: string,"instructions"?: string | null,"medication_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "medication_versions_medication_id_fkey"
      columns: ["medication_id"]
isOneToOne: false
      referencedRelation: "medications"
      referencedColumns: ["id"]
    }
                  ]
                },"medications": {
                  Row: {
                    "active": boolean,"created_at": string,"duplicate_warning_minutes": number,"form": string,"id": string,"name": string,"pet_id": string,"prescribed_by": string | null,"quantity_on_hand": number | null,"refill_alert_at": number | null,"strength": string | null,"unit": string,"updated_at": string,"with_food": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"duplicate_warning_minutes"?: number,"form"?: string,"id"?: string,"name": string,"pet_id": string,"prescribed_by"?: string | null,"quantity_on_hand"?: number | null,"refill_alert_at"?: number | null,"strength"?: string | null,"unit"?: string,"updated_at"?: string,"with_food"?: boolean
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"duplicate_warning_minutes"?: number,"form"?: string,"id"?: string,"name"?: string,"pet_id"?: string,"prescribed_by"?: string | null,"quantity_on_hand"?: number | null,"refill_alert_at"?: number | null,"strength"?: string | null,"unit"?: string,"updated_at"?: string,"with_food"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "medications_pet_id_fkey"
      columns: ["pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    }
                  ]
                },"observation_events": {
                  Row: {
                    "created_at": string,"id": string,"is_urgent": boolean,"kind": string,"logged_by": string | null,"media_paths": (string)[],"note": string | null,"observed_at": string,"pet_id": string,"scale_value": number | null,"unit": string | null,"value_num": number | null,"value_text": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"is_urgent"?: boolean,"kind": string,"logged_by"?: string | null,"media_paths"?: (string)[],"note"?: string | null,"observed_at"?: string,"pet_id": string,"scale_value"?: number | null,"unit"?: string | null,"value_num"?: number | null,"value_text"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_urgent"?: boolean,"kind"?: string,"logged_by"?: string | null,"media_paths"?: (string)[],"note"?: string | null,"observed_at"?: string,"pet_id"?: string,"scale_value"?: number | null,"unit"?: string | null,"value_num"?: number | null,"value_text"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "observation_events_pet_id_fkey"
      columns: ["pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    }
                  ]
                },"pet_conditions": {
                  Row: {
                    "created_at": string,"diagnosed_on": string | null,"id": string,"notes": string | null,"pet_id": string,"preset_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"diagnosed_on"?: string | null,"id"?: string,"notes"?: string | null,"pet_id": string,"preset_key": string
                  }
                  Update: {
                    "created_at"?: string,"diagnosed_on"?: string | null,"id"?: string,"notes"?: string | null,"pet_id"?: string,"preset_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pet_conditions_pet_id_fkey"
      columns: ["pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pet_conditions_preset_key_fkey"
      columns: ["preset_key"]
isOneToOne: false
      referencedRelation: "condition_presets"
      referencedColumns: ["key"]
    }
                  ]
                },"pet_thresholds": {
                  Row: {
                    "comparator": string,"created_at": string,"created_by": string | null,"id": string,"metric": string,"pet_id": string,"unit": string,"value": number,"vet_instruction": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "comparator": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"metric": string,"pet_id": string,"unit": string,"value": number,"vet_instruction"?: string | null
                  }
                  Update: {
                    "comparator"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"metric"?: string,"pet_id"?: string,"unit"?: string,"value"?: number,"vet_instruction"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pet_thresholds_pet_id_fkey"
      columns: ["pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    }
                  ]
                },"pets": {
                  Row: {
                    "birth_date": string | null,"breed": string | null,"created_at": string,"household_id": string,"id": string,"name": string,"passed_on": string | null,"photo_path": string | null,"sex": string | null,"species": string,"status": Database["public"]['Enums']["pet_status"],"updated_at": string,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"breed"?: string | null,"created_at"?: string,"household_id": string,"id"?: string,"name": string,"passed_on"?: string | null,"photo_path"?: string | null,"sex"?: string | null,"species": string,"status"?: Database["public"]['Enums']["pet_status"],"updated_at"?: string,"weight_kg"?: number | null
                  }
                  Update: {
                    "birth_date"?: string | null,"breed"?: string | null,"created_at"?: string,"household_id"?: string,"id"?: string,"name"?: string,"passed_on"?: string | null,"photo_path"?: string | null,"sex"?: string | null,"species"?: string,"status"?: Database["public"]['Enums']["pet_status"],"updated_at"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pets_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"vet_contacts": {
                  Row: {
                    "clinic": string | null,"created_at": string,"household_id": string,"id": string,"kind": Database["public"]['Enums']["contact_kind"],"name": string,"notes": string | null,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "clinic"?: string | null,"created_at"?: string,"household_id": string,"id"?: string,"kind"?: Database["public"]['Enums']["contact_kind"],"name": string,"notes"?: string | null,"phone"?: string | null
                  }
                  Update: {
                    "clinic"?: string | null,"created_at"?: string,"household_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["contact_kind"],"name"?: string,"notes"?: string | null,"phone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vet_contacts_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "activity_feed": {
                  Row: {
                    "detail": string | null,"id": string | null,"logged_by": string | null,"occurred_at": string | null,"pet_id": string | null,"title": string | null,"type": string | null,"voided_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"change_dose":
{ Args: { "p_dose_amount": number,"p_instructions"?: string,"p_medication_id": string }; Returns: string
                           },
"create_household":
{ Args: { "p_name": string,"p_timezone"?: string }; Returns: string
                           },
"current_role_in":
{ Args: { "p_household": string }; Returns: Database["public"]['Enums']["member_role"]
                           },
"has_role":
{ Args: { "p_household": string,"p_roles": (Database["public"]['Enums']["member_role"])[] }; Returns: boolean
                           },
"is_member":
{ Args: { "p_household": string }; Returns: boolean
                           },
"log_dose":
{ Args: { "p_amount"?: number,"p_force"?: boolean,"p_given_at"?: string,"p_id": string,"p_medication_id": string,"p_note"?: string,"p_outcome": Database["public"]['Enums']["dose_outcome"],"p_scheduled_for"?: string }; Returns: Json
                           },
"pet_household":
{ Args: { "p_pet": string }; Returns: string
                           },
"safe_uuid":
{ Args: { "p": string }; Returns: string
                           },
"set_pet_memorial":
{ Args: { "p_passed_on"?: string,"p_pet": string }; Returns: undefined
                           },
"void_dose":
{ Args: { "p_id": string,"p_reason"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "contact_kind": "regular_vet"|"emergency_clinic"|"other","dose_outcome": "given"|"skipped"|"refused"|"vomited_after","member_role": "owner"|"caregiver"|"sitter"|"vet","pet_status": "active"|"memorial"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "contact_kind": ["regular_vet", "emergency_clinic", "other"],"dose_outcome": ["given", "skipped", "refused", "vomited_after"],"member_role": ["owner", "caregiver", "sitter", "vet"],"pet_status": ["active", "memorial"]
          }
        }
} as const
