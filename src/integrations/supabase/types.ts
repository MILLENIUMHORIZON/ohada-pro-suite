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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_move_lines: {
        Row: {
          account_id: string
          amount_currency: number | null
          created_at: string | null
          credit: number | null
          currency: string | null
          debit: number | null
          id: string
          maturity_date: string | null
          move_id: string | null
          partner_id: string | null
          reconciled_group_id: string | null
          tax_id: string | null
        }
        Insert: {
          account_id: string
          amount_currency?: number | null
          created_at?: string | null
          credit?: number | null
          currency?: string | null
          debit?: number | null
          id?: string
          maturity_date?: string | null
          move_id?: string | null
          partner_id?: string | null
          reconciled_group_id?: string | null
          tax_id?: string | null
        }
        Update: {
          account_id?: string
          amount_currency?: number | null
          created_at?: string | null
          credit?: number | null
          currency?: string | null
          debit?: number | null
          id?: string
          maturity_date?: string | null
          move_id?: string | null
          partner_id?: string | null
          reconciled_group_id?: string | null
          tax_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_move_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_move_lines_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "account_moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_move_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_move_lines_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      account_moves: {
        Row: {
          created_at: string | null
          date: string
          id: string
          journal_id: string
          number: string
          period_id: string | null
          ref: string | null
          state: Database["public"]["Enums"]["move_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          journal_id: string
          number: string
          period_id?: string | null
          ref?: string | null
          state?: Database["public"]["Enums"]["move_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          journal_id?: string
          number?: string
          period_id?: string | null
          ref?: string | null
          state?: Database["public"]["Enums"]["move_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_moves_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_moves_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          reconcilable: boolean | null
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          reconcilable?: boolean | null
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          reconcilable?: boolean | null
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string | null
          currency: string | null
          email: string | null
          id: string
          id_nat: string | null
          name: string
          nif: string | null
          phone: string | null
          rccm: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          id_nat?: string | null
          name: string
          nif?: string | null
          phone?: string | null
          rccm?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          id_nat?: string | null
          name?: string
          nif?: string | null
          phone?: string | null
          rccm?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          close_date: string | null
          created_at: string | null
          description: string | null
          expected_revenue: number | null
          id: string
          owner_id: string | null
          partner_id: string | null
          probability: number | null
          source: string | null
          stage_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          close_date?: string | null
          created_at?: string | null
          description?: string | null
          expected_revenue?: number | null
          id?: string
          owner_id?: string | null
          partner_id?: string | null
          probability?: number | null
          source?: string | null
          stage_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          close_date?: string | null
          created_at?: string | null
          description?: string | null
          expected_revenue?: number | null
          id?: string
          owner_id?: string | null
          partner_id?: string | null
          probability?: number | null
          source?: string | null
          stage_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      crm_stages: {
        Row: {
          created_at: string | null
          id: string
          name: string
          order_seq: number
          pipeline_id: string | null
          won_flag: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          order_seq?: number
          pipeline_id?: string | null
          won_flag?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          order_seq?: number
          pipeline_id?: string | null
          won_flag?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          invoice_id: string | null
          product_id: string
          qty: number
          subtotal: number | null
          tax_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          product_id: string
          qty?: number
          subtotal?: number | null
          tax_id?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          product_id?: string
          qty?: number
          subtotal?: number | null
          tax_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          currency: string | null
          date: string
          due_date: string | null
          id: string
          notes: string | null
          number: string
          order_id: string | null
          partner_id: string
          status: Database["public"]["Enums"]["invoice_status"] | null
          total_ht: number | null
          total_tax: number | null
          total_ttc: number | null
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          date?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          number: string
          order_id?: string | null
          partner_id: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          total_ht?: number | null
          total_tax?: number | null
          total_ttc?: number | null
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          date?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          number?: string
          order_id?: string | null
          partner_id?: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          total_ht?: number | null
          total_tax?: number | null
          total_ttc?: number | null
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sale_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      journals: {
        Row: {
          code: string
          created_at: string | null
          default_credit_account_id: string | null
          default_debit_account_id: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["journal_type"]
        }
        Insert: {
          code: string
          created_at?: string | null
          default_credit_account_id?: string | null
          default_debit_account_id?: string | null
          id?: string
          name: string
          type: Database["public"]["Enums"]["journal_type"]
        }
        Update: {
          code?: string
          created_at?: string | null
          default_credit_account_id?: string | null
          default_debit_account_id?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["journal_type"]
        }
        Relationships: [
          {
            foreignKeyName: "journals_default_credit_account_id_fkey"
            columns: ["default_credit_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_default_debit_account_id_fkey"
            columns: ["default_debit_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          nif: string | null
          phone: string | null
          type: Database["public"]["Enums"]["partner_type"]
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          nif?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["partner_type"]
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          nif?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["partner_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          date: string
          id: string
          invoice_id: string | null
          method: string | null
          notes: string | null
          number: string
          partner_id: string
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          date?: string
          id?: string
          invoice_id?: string | null
          method?: string | null
          notes?: string | null
          number: string
          partner_id: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          date?: string
          id?: string
          invoice_id?: string | null
          method?: string | null
          notes?: string | null
          number?: string
          partner_id?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      periods: {
        Row: {
          closed: boolean | null
          created_at: string | null
          date_end: string
          date_start: string
          id: string
          name: string
        }
        Insert: {
          closed?: boolean | null
          created_at?: string | null
          date_end: string
          date_start: string
          id?: string
          name: string
        }
        Update: {
          closed?: boolean | null
          created_at?: string | null
          date_end?: string
          date_start?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          category_id: string | null
          cost_method: Database["public"]["Enums"]["cost_method"] | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          sku: string
          tax_id: string | null
          type: Database["public"]["Enums"]["product_type"]
          unit_price: number | null
          uom_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category_id?: string | null
          cost_method?: Database["public"]["Enums"]["cost_method"] | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          sku: string
          tax_id?: string | null
          type?: Database["public"]["Enums"]["product_type"]
          unit_price?: number | null
          uom_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category_id?: string | null
          cost_method?: Database["public"]["Enums"]["cost_method"] | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sku?: string
          tax_id?: string | null
          type?: Database["public"]["Enums"]["product_type"]
          unit_price?: number | null
          uom_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_order_lines: {
        Row: {
          created_at: string | null
          discount: number | null
          id: string
          order_id: string | null
          product_id: string
          qty: number
          subtotal: number | null
          tax_id: string | null
          unit_price: number
          uom_id: string | null
        }
        Insert: {
          created_at?: string | null
          discount?: number | null
          id?: string
          order_id?: string | null
          product_id: string
          qty?: number
          subtotal?: number | null
          tax_id?: string | null
          unit_price?: number
          uom_id?: string | null
        }
        Update: {
          created_at?: string | null
          discount?: number | null
          id?: string
          order_id?: string | null
          product_id?: string
          qty?: number
          subtotal?: number | null
          tax_id?: string | null
          unit_price?: number
          uom_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sale_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_order_lines_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_order_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_orders: {
        Row: {
          created_at: string | null
          currency: string | null
          date: string
          id: string
          notes: string | null
          number: string
          partner_id: string
          status: Database["public"]["Enums"]["sale_status"] | null
          total_ht: number | null
          total_tax: number | null
          total_ttc: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          date?: string
          id?: string
          notes?: string | null
          number: string
          partner_id: string
          status?: Database["public"]["Enums"]["sale_status"] | null
          total_ht?: number | null
          total_tax?: number | null
          total_ttc?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          date?: string
          id?: string
          notes?: string | null
          number?: string
          partner_id?: string
          status?: Database["public"]["Enums"]["sale_status"] | null
          total_ht?: number | null
          total_tax?: number | null
          total_ttc?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          code: string
          created_at: string | null
          current: number | null
          id: string
          padding: number | null
          prefix: string
        }
        Insert: {
          code: string
          created_at?: string | null
          current?: number | null
          id?: string
          padding?: number | null
          prefix: string
        }
        Update: {
          code?: string
          created_at?: string | null
          current?: number | null
          id?: string
          padding?: number | null
          prefix?: string
        }
        Relationships: []
      }
      stock_locations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          type: Database["public"]["Enums"]["location_type"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["location_type"]
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["location_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_moves: {
        Row: {
          cost: number | null
          created_at: string | null
          date: string
          from_location_id: string
          id: string
          origin: string | null
          product_id: string
          qty: number
          reference: string | null
          state: Database["public"]["Enums"]["stock_move_status"] | null
          to_location_id: string
          uom_id: string | null
          updated_at: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          date?: string
          from_location_id: string
          id?: string
          origin?: string | null
          product_id: string
          qty?: number
          reference?: string | null
          state?: Database["public"]["Enums"]["stock_move_status"] | null
          to_location_id: string
          uom_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          date?: string
          from_location_id?: string
          id?: string
          origin?: string | null
          product_id?: string
          qty?: number
          reference?: string | null
          state?: Database["public"]["Enums"]["stock_move_status"] | null
          to_location_id?: string
          uom_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_moves_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_quants: {
        Row: {
          cost: number | null
          id: string
          location_id: string
          product_id: string
          qty_on_hand: number | null
          updated_at: string | null
        }
        Insert: {
          cost?: number | null
          id?: string
          location_id: string
          product_id: string
          qty_on_hand?: number | null
          updated_at?: string | null
        }
        Update: {
          cost?: number | null
          id?: string
          location_id?: string
          product_id?: string
          qty_on_hand?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_quants_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      taxes: {
        Row: {
          account_collected_id: string | null
          account_deductible_id: string | null
          created_at: string | null
          id: string
          name: string
          rate: number
        }
        Insert: {
          account_collected_id?: string | null
          account_deductible_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          rate?: number
        }
        Update: {
          account_collected_id?: string | null
          account_deductible_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          rate?: number
        }
        Relationships: []
      }
      uom: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          ratio: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          ratio?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          ratio?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      cost_method: "fifo" | "average"
      invoice_status: "draft" | "posted" | "paid" | "cancelled"
      invoice_type: "customer" | "vendor" | "credit_note"
      journal_type: "sales" | "purchases" | "cash" | "bank" | "misc"
      location_type: "internal" | "supplier" | "customer" | "transit" | "scrap"
      move_status: "draft" | "posted"
      partner_type: "customer" | "vendor" | "both"
      payment_status: "draft" | "posted" | "cancelled"
      product_type: "stock" | "service"
      sale_status: "draft" | "confirmed" | "done" | "cancelled"
      stock_move_status: "draft" | "confirmed" | "done" | "cancelled"
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
    Enums: {
      account_type: ["asset", "liability", "equity", "income", "expense"],
      cost_method: ["fifo", "average"],
      invoice_status: ["draft", "posted", "paid", "cancelled"],
      invoice_type: ["customer", "vendor", "credit_note"],
      journal_type: ["sales", "purchases", "cash", "bank", "misc"],
      location_type: ["internal", "supplier", "customer", "transit", "scrap"],
      move_status: ["draft", "posted"],
      partner_type: ["customer", "vendor", "both"],
      payment_status: ["draft", "posted", "cancelled"],
      product_type: ["stock", "service"],
      sale_status: ["draft", "confirmed", "done", "cancelled"],
      stock_move_status: ["draft", "confirmed", "done", "cancelled"],
    },
  },
} as const
