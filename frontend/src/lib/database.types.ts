export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          business_name: string
          contact_email: string
          kra_pin: string | null
          registration_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          business_name: string
          contact_email: string
          kra_pin?: string | null
          registration_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_name?: string
          contact_email?: string
          kra_pin?: string | null
          registration_number?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      transaction_uploads: {
        Row: {
          id: string
          business_id: string
          file_name: string
          transaction_count: number
          date_range_start: string | null
          date_range_end: string | null
          total_volume: number
          status: 'pending' | 'parsed' | 'failed'
          uploaded_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          file_name: string
          transaction_count?: number
          date_range_start?: string | null
          date_range_end?: string | null
          total_volume?: number
          status?: 'pending' | 'parsed' | 'failed'
          uploaded_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          file_name?: string
          transaction_count?: number
          date_range_start?: string | null
          date_range_end?: string | null
          total_volume?: number
          status?: 'pending' | 'parsed' | 'failed'
          uploaded_at?: string
          processed_at?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          upload_id: string
          business_id: string
          transaction_date: string
          transaction_type: string
          amount: number
          balance_after: number | null
          customer_hash: string | null
          created_at: string
        }
        Insert: {
          id?: string
          upload_id: string
          business_id: string
          transaction_date: string
          transaction_type: string
          amount: number
          balance_after?: number | null
          customer_hash?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          upload_id?: string
          business_id?: string
          transaction_date?: string
          transaction_type?: string
          amount?: number
          balance_after?: number | null
          customer_hash?: string | null
          created_at?: string
        }
      }
      proofs: {
        Row: {
          id: string
          business_id: string
          upload_id: string | null
          verification_code: string
          credit_score: number
          monthly_volume: number
          average_ticket_size: number
          customer_diversity_score: number
          growth_trend: 'growing' | 'stable' | 'declining'
          consistency_score: number
          activity_frequency: 'high' | 'medium' | 'low'
          proof_data: Json
          circuit_version: string
          status: 'generating' | 'valid' | 'expired' | 'failed'
          generated_at: string
          expires_at: string
          verified_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          upload_id?: string | null
          verification_code: string
          credit_score: number
          monthly_volume: number
          average_ticket_size: number
          customer_diversity_score: number
          growth_trend: 'growing' | 'stable' | 'declining'
          consistency_score: number
          activity_frequency: 'high' | 'medium' | 'low'
          proof_data?: Json
          circuit_version?: string
          status?: 'generating' | 'valid' | 'expired' | 'failed'
          generated_at?: string
          expires_at: string
          verified_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          upload_id?: string | null
          verification_code?: string
          credit_score?: number
          monthly_volume?: number
          average_ticket_size?: number
          customer_diversity_score?: number
          growth_trend?: 'growing' | 'stable' | 'declining'
          consistency_score?: number
          activity_frequency?: 'high' | 'medium' | 'low'
          proof_data?: Json
          circuit_version?: string
          status?: 'generating' | 'valid' | 'expired' | 'failed'
          generated_at?: string
          expires_at?: string
          verified_at?: string | null
        }
      }
      verification_logs: {
        Row: {
          id: string
          proof_id: string
          verification_code: string
          verified_at: string
          success: boolean
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          proof_id: string
          verification_code: string
          verified_at?: string
          success?: boolean
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          proof_id?: string
          verification_code?: string
          verified_at?: string
          success?: boolean
          ip_address?: string | null
          user_agent?: string | null
        }
      }
    }
  }
}
