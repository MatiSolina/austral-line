
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
            "alumnos_carreras": {
                  Row: {
                    "carrera_id": number,"created_at": string,"persona_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "carrera_id": number,"created_at"?: string,"persona_id": string
                  }
                  Update: {
                    "carrera_id"?: number,"created_at"?: string,"persona_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alumnos_carreras_carrera_id_fkey"
      columns: ["carrera_id"]
isOneToOne: false
      referencedRelation: "alumnos_carreras_maestro"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alumnos_carreras_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: true
      referencedRelation: "personas"
      referencedColumns: ["id"]
    }
                  ]
                },"alumnos_carreras_maestro": {
                  Row: {
                    "activo": boolean,"created_at": string,"id": number,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"created_at"?: string,"id"?: never,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "activo"?: boolean,"created_at"?: string,"id"?: never,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [
                    
                  ]
                },"alumnos_intereses": {
                  Row: {
                    "estrellas": number,"interes_id": number,"persona_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "estrellas": number,"interes_id": number,"persona_id": string,"updated_at"?: string
                  }
                  Update: {
                    "estrellas"?: number,"interes_id"?: number,"persona_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alumnos_intereses_interes_id_fkey"
      columns: ["interes_id"]
isOneToOne: false
      referencedRelation: "alumnos_intereses_maestro"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alumnos_intereses_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    }
                  ]
                },"alumnos_intereses_historial": {
                  Row: {
                    "cambiado_en": string,"estrellas_antes": number | null,"estrellas_despues": number | null,"id": number,"interes_id": number,"persona_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cambiado_en"?: string,"estrellas_antes"?: number | null,"estrellas_despues"?: number | null,"id"?: never,"interes_id": number,"persona_id": string
                  }
                  Update: {
                    "cambiado_en"?: string,"estrellas_antes"?: number | null,"estrellas_despues"?: number | null,"id"?: never,"interes_id"?: number,"persona_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"alumnos_intereses_maestro": {
                  Row: {
                    "activo": boolean,"created_at": string,"id": number,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"created_at"?: string,"id"?: never,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "activo"?: boolean,"created_at"?: string,"id"?: never,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [
                    
                  ]
                },"alumnos_perfiles": {
                  Row: {
                    "busca_equipo": boolean,"persona_id": string,"sobre_mi": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "busca_equipo"?: boolean,"persona_id": string,"sobre_mi"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "busca_equipo"?: boolean,"persona_id"?: string,"sobre_mi"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alumnos_perfiles_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: true
      referencedRelation: "personas"
      referencedColumns: ["id"]
    }
                  ]
                },"eventos": {
                  Row: {
                    "created_at": string,"fin": string | null,"id": string,"inicio": string,"lugar": string | null,"nombre": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"fin"?: string | null,"id"?: string,"inicio": string,"lugar"?: string | null,"nombre": string,"tipo": string
                  }
                  Update: {
                    "created_at"?: string,"fin"?: string | null,"id"?: string,"inicio"?: string,"lugar"?: string | null,"nombre"?: string,"tipo"?: string
                  }
                  Relationships: [
                    
                  ]
                },"jurado_criterios": {
                  Row: {
                    "created_at": string,"descripcion": string | null,"id": string,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"descripcion"?: string | null,"id"?: string,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "created_at"?: string,"descripcion"?: string | null,"id"?: string,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [
                    
                  ]
                },"jurado_envios": {
                  Row: {
                    "asunto": string,"created_at": string,"email": string,"error": string | null,"estado": string,"evento_id": string,"id": string,"persona_id": string | null,"programado_para": string | null,"resend_id": string | null,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asunto": string,"created_at"?: string,"email": string,"error"?: string | null,"estado": string,"evento_id": string,"id"?: string,"persona_id"?: string | null,"programado_para"?: string | null,"resend_id"?: string | null,"tipo": string
                  }
                  Update: {
                    "asunto"?: string,"created_at"?: string,"email"?: string,"error"?: string | null,"estado"?: string,"evento_id"?: string,"id"?: string,"persona_id"?: string | null,"programado_para"?: string | null,"resend_id"?: string | null,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_envios_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_envios_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    }
                  ]
                },"jurado_evaluaciones": {
                  Row: {
                    "comentarios": string | null,"created_at": string,"id": string,"jurado_id": string,"propuesta_valor": string | null,"proyecto_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comentarios"?: string | null,"created_at"?: string,"id"?: string,"jurado_id": string,"propuesta_valor"?: string | null,"proyecto_id": string,"updated_at"?: string
                  }
                  Update: {
                    "comentarios"?: string | null,"created_at"?: string,"id"?: string,"jurado_id"?: string,"propuesta_valor"?: string | null,"proyecto_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_evaluaciones_jurado_id_fkey"
      columns: ["jurado_id"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_evaluaciones_proyecto_id_fkey"
      columns: ["proyecto_id"]
isOneToOne: false
      referencedRelation: "proyectos"
      referencedColumns: ["id"]
    }
                  ]
                },"jurado_fichas": {
                  Row: {
                    "etapa": string | null,"link_presentacion": string | null,"mercado": string | null,"modelo_negocio": string | null,"problema": string | null,"propuesta_valor": string | null,"proyecto_id": string,"solucion": string | null,"traccion": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "etapa"?: string | null,"link_presentacion"?: string | null,"mercado"?: string | null,"modelo_negocio"?: string | null,"problema"?: string | null,"propuesta_valor"?: string | null,"proyecto_id": string,"solucion"?: string | null,"traccion"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "etapa"?: string | null,"link_presentacion"?: string | null,"mercado"?: string | null,"modelo_negocio"?: string | null,"problema"?: string | null,"propuesta_valor"?: string | null,"proyecto_id"?: string,"solucion"?: string | null,"traccion"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_fichas_proyecto_id_fkey"
      columns: ["proyecto_id"]
isOneToOne: true
      referencedRelation: "proyectos"
      referencedColumns: ["id"]
    }
                  ]
                },"jurado_material_post": {
                  Row: {
                    "evento_id": string,"foto_1": string | null,"foto_2": string | null,"foto_3": string | null,"mensaje": string | null,"updated_at": string,"video": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "evento_id": string,"foto_1"?: string | null,"foto_2"?: string | null,"foto_3"?: string | null,"mensaje"?: string | null,"updated_at"?: string,"video"?: string | null
                  }
                  Update: {
                    "evento_id"?: string,"foto_1"?: string | null,"foto_2"?: string | null,"foto_3"?: string | null,"mensaje"?: string | null,"updated_at"?: string,"video"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_material_post_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: true
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    }
                  ]
                },"jurado_puntajes": {
                  Row: {
                    "criterio_id": string,"evaluacion_id": string,"puntaje": number
                  }
                  ComputedFields: never
                  Insert: {
                    "criterio_id": string,"evaluacion_id": string,"puntaje": number
                  }
                  Update: {
                    "criterio_id"?: string,"evaluacion_id"?: string,"puntaje"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_puntajes_criterio_id_fkey"
      columns: ["criterio_id"]
isOneToOne: false
      referencedRelation: "jurado_criterios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_puntajes_evaluacion_id_fkey"
      columns: ["evaluacion_id"]
isOneToOne: false
      referencedRelation: "jurado_evaluaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"personas": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"nombre": string,"rol": Database["public"]['Enums']["rol"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"nombre": string,"rol": Database["public"]['Enums']["rol"]
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"nombre"?: string,"rol"?: Database["public"]['Enums']["rol"]
                  }
                  Relationships: [
                    
                  ]
                },"proyecto_integrantes": {
                  Row: {
                    "persona_id": string,"proyecto_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "persona_id": string,"proyecto_id": string
                  }
                  Update: {
                    "persona_id"?: string,"proyecto_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proyecto_integrantes_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proyecto_integrantes_proyecto_id_fkey"
      columns: ["proyecto_id"]
isOneToOne: false
      referencedRelation: "proyectos"
      referencedColumns: ["id"]
    }
                  ]
                },"proyectos": {
                  Row: {
                    "created_at": string,"descripcion": string | null,"estado": string,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"descripcion"?: string | null,"estado"?: string,"id"?: string,"nombre": string
                  }
                  Update: {
                    "created_at"?: string,"descripcion"?: string | null,"estado"?: string,"id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "alumnos_guardar_perfil":
{ Args: { "p_busca_equipo": boolean,"p_carrera_id": number,"p_intereses": Json,"p_sobre_mi": string }; Returns: undefined
                           },
"mi_rol":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["rol"]
                           }
          }
          Enums: {
            "rol": "alumno"|"mentor"|"jurado"|"admin"
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
            "rol": ["alumno", "mentor", "jurado", "admin"]
          }
        }
} as const
