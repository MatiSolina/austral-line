
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
                },"jurado_ausencias": {
                  Row: {
                    "evento_id": string,"marcado_at": string,"marcado_por": string | null,"proyecto_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "evento_id": string,"marcado_at"?: string,"marcado_por"?: string | null,"proyecto_id": string
                  }
                  Update: {
                    "evento_id"?: string,"marcado_at"?: string,"marcado_por"?: string | null,"proyecto_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_ausencias_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_ausencias_marcado_por_fkey"
      columns: ["marcado_por"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_ausencias_proyecto_id_fkey"
      columns: ["proyecto_id"]
isOneToOne: false
      referencedRelation: "proyectos"
      referencedColumns: ["id"]
    }
                  ]
                },"jurado_criterios": {
                  Row: {
                    "created_at": string,"descripcion": string | null,"es_base": boolean,"id": string,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"descripcion"?: string | null,"es_base"?: boolean,"id"?: string,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "created_at"?: string,"descripcion"?: string | null,"es_base"?: boolean,"id"?: string,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [
                    
                  ]
                },"jurado_devolucion_envios": {
                  Row: {
                    "created_at": string,"email": string,"error": string | null,"estado": string,"evento_id": string,"id": string,"persona_id": string | null,"proyecto_id": string,"resend_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"error"?: string | null,"estado": string,"evento_id": string,"id"?: string,"persona_id"?: string | null,"proyecto_id": string,"resend_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"error"?: string | null,"estado"?: string,"evento_id"?: string,"id"?: string,"persona_id"?: string | null,"proyecto_id"?: string,"resend_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_devolucion_envios_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_devolucion_envios_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_devolucion_envios_proyecto_id_fkey"
      columns: ["proyecto_id"]
isOneToOne: false
      referencedRelation: "proyectos"
      referencedColumns: ["id"]
    }
                  ]
                },"jurado_devoluciones": {
                  Row: {
                    "actualizada_at": string | null,"comentarios": (string)[],"evaluaciones": number,"evento_id": string,"huella": string | null,"motivo_correccion": string | null,"promedio_general": number | null,"promedios": NonNullable<Json>,"propuestas": (string)[],"proyecto_id": string,"revisada_at": string | null,"revisada_por": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizada_at"?: string | null,"comentarios"?: (string)[],"evaluaciones"?: number,"evento_id": string,"huella"?: string | null,"motivo_correccion"?: string | null,"promedio_general"?: number | null,"promedios"?: NonNullable<Json>,"propuestas"?: (string)[],"proyecto_id": string,"revisada_at"?: string | null,"revisada_por"?: string | null
                  }
                  Update: {
                    "actualizada_at"?: string | null,"comentarios"?: (string)[],"evaluaciones"?: number,"evento_id"?: string,"huella"?: string | null,"motivo_correccion"?: string | null,"promedio_general"?: number | null,"promedios"?: NonNullable<Json>,"propuestas"?: (string)[],"proyecto_id"?: string,"revisada_at"?: string | null,"revisada_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_devoluciones_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_devoluciones_proyecto_id_fkey"
      columns: ["proyecto_id"]
isOneToOne: false
      referencedRelation: "proyectos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_devoluciones_revisada_por_fkey"
      columns: ["revisada_por"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    }
                  ]
                },"jurado_devoluciones_historial": {
                  Row: {
                    "cambiado_at": string,"cambiado_por": string | null,"comentarios": (string)[],"evento_id": string,"id": string,"motivo": string,"propuestas": (string)[],"proyecto_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cambiado_at"?: string,"cambiado_por"?: string | null,"comentarios": (string)[],"evento_id": string,"id"?: string,"motivo": string,"propuestas": (string)[],"proyecto_id": string
                  }
                  Update: {
                    "cambiado_at"?: string,"cambiado_por"?: string | null,"comentarios"?: (string)[],"evento_id"?: string,"id"?: string,"motivo"?: string,"propuestas"?: (string)[],"proyecto_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_devoluciones_historial_cambiado_por_fkey"
      columns: ["cambiado_por"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_devoluciones_historial_evento_id_proyecto_id_fkey"
      columns: ["evento_id","proyecto_id"]
isOneToOne: false
      referencedRelation: "jurado_devoluciones"
      referencedColumns: ["evento_id","proyecto_id"]
    }
                  ]
                },"jurado_devoluciones_vistos": {
                  Row: {
                    "comentarios": (string)[],"evento_id": string,"propuestas": (string)[],"proyecto_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comentarios"?: (string)[],"evento_id": string,"propuestas"?: (string)[],"proyecto_id": string
                  }
                  Update: {
                    "comentarios"?: (string)[],"evento_id"?: string,"propuestas"?: (string)[],"proyecto_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_devoluciones_vistos_evento_id_proyecto_id_fkey"
      columns: ["evento_id","proyecto_id"]
isOneToOne: true
      referencedRelation: "jurado_devoluciones"
      referencedColumns: ["evento_id","proyecto_id"]
    }
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
                    "comentarios": string | null,"created_at": string,"evento_id": string | null,"id": string,"jurado_id": string,"propuesta_valor": string | null,"proyecto_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comentarios"?: string | null,"created_at"?: string,"evento_id"?: string | null,"id"?: string,"jurado_id": string,"propuesta_valor"?: string | null,"proyecto_id": string,"updated_at"?: string
                  }
                  Update: {
                    "comentarios"?: string | null,"created_at"?: string,"evento_id"?: string | null,"id"?: string,"jurado_id"?: string,"propuesta_valor"?: string | null,"proyecto_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_evaluaciones_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    },{
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
                },"jurado_evento_criterios": {
                  Row: {
                    "criterio_id": string,"evento_id": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "criterio_id": string,"evento_id": string,"orden"?: number
                  }
                  Update: {
                    "criterio_id"?: string,"evento_id"?: string,"orden"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_evento_criterios_criterio_id_fkey"
      columns: ["criterio_id"]
isOneToOne: false
      referencedRelation: "jurado_criterios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_evento_criterios_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
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
                },"jurado_publicaciones": {
                  Row: {
                    "evento_id": string,"publicada_at": string,"publicada_por": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "evento_id": string,"publicada_at"?: string,"publicada_por"?: string | null
                  }
                  Update: {
                    "evento_id"?: string,"publicada_at"?: string,"publicada_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_publicaciones_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: true
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_publicaciones_publicada_por_fkey"
      columns: ["publicada_por"]
isOneToOne: false
      referencedRelation: "personas"
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
                },"jurado_salon_jurados": {
                  Row: {
                    "evento_id": string,"jurado_id": string,"salon_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "evento_id": string,"jurado_id": string,"salon_id": string
                  }
                  Update: {
                    "evento_id"?: string,"jurado_id"?: string,"salon_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_salon_jurados_jurado_id_fkey"
      columns: ["jurado_id"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_salon_jurados_salon_id_evento_id_fkey"
      columns: ["salon_id","evento_id"]
isOneToOne: false
      referencedRelation: "jurado_salones"
      referencedColumns: ["id","evento_id"]
    }
                  ]
                },"jurado_salon_proyectos": {
                  Row: {
                    "evento_id": string,"proyecto_id": string,"salon_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "evento_id": string,"proyecto_id": string,"salon_id": string
                  }
                  Update: {
                    "evento_id"?: string,"proyecto_id"?: string,"salon_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_salon_proyectos_proyecto_id_fkey"
      columns: ["proyecto_id"]
isOneToOne: false
      referencedRelation: "proyectos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jurado_salon_proyectos_salon_id_evento_id_fkey"
      columns: ["salon_id","evento_id"]
isOneToOne: false
      referencedRelation: "jurado_salones"
      referencedColumns: ["id","evento_id"]
    }
                  ]
                },"jurado_salones": {
                  Row: {
                    "created_at": string,"evento_id": string,"id": string,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"evento_id": string,"id"?: string,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "created_at"?: string,"evento_id"?: string,"id"?: string,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "jurado_salones_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    }
                  ]
                },"mentores_encuestas": {
                  Row: {
                    "con_quien": string,"created_at": string,"escalada_at": string | null,"estado": string,"grave": boolean | null,"grave_motivo": string | null,"id": string,"mail_error": string | null,"mail_estado": string | null,"mejorar": string | null,"papel": string,"persona_id": string,"proyecto_nombre": string,"puntaje": number | null,"recordatorio_at": string | null,"respondida_at": string | null,"reunion_id": string,"reunion_inicio": string,"sirvio": string | null,"urgente": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "con_quien": string,"created_at"?: string,"escalada_at"?: string | null,"estado"?: string,"grave"?: boolean | null,"grave_motivo"?: string | null,"id"?: string,"mail_error"?: string | null,"mail_estado"?: string | null,"mejorar"?: string | null,"papel": string,"persona_id": string,"proyecto_nombre": string,"puntaje"?: number | null,"recordatorio_at"?: string | null,"respondida_at"?: string | null,"reunion_id": string,"reunion_inicio": string,"sirvio"?: string | null,"urgente"?: string | null
                  }
                  Update: {
                    "con_quien"?: string,"created_at"?: string,"escalada_at"?: string | null,"estado"?: string,"grave"?: boolean | null,"grave_motivo"?: string | null,"id"?: string,"mail_error"?: string | null,"mail_estado"?: string | null,"mejorar"?: string | null,"papel"?: string,"persona_id"?: string,"proyecto_nombre"?: string,"puntaje"?: number | null,"recordatorio_at"?: string | null,"respondida_at"?: string | null,"reunion_id"?: string,"reunion_inicio"?: string,"sirvio"?: string | null,"urgente"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mentores_encuestas_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mentores_encuestas_reunion_id_fkey"
      columns: ["reunion_id"]
isOneToOne: false
      referencedRelation: "mentores_reuniones"
      referencedColumns: ["id"]
    }
                  ]
                },"mentores_feedback_resumenes": {
                  Row: {
                    "aviso": string | null,"con_ia": boolean,"created_at": string,"id": string,"pedidas": number,"respuestas": number,"resumen": string,"reunion_id": string,"util": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aviso"?: string | null,"con_ia": boolean,"created_at"?: string,"id"?: string,"pedidas": number,"respuestas": number,"resumen": string,"reunion_id": string,"util"?: boolean | null
                  }
                  Update: {
                    "aviso"?: string | null,"con_ia"?: boolean,"created_at"?: string,"id"?: string,"pedidas"?: number,"respuestas"?: number,"resumen"?: string,"reunion_id"?: string,"util"?: boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mentores_feedback_resumenes_reunion_id_fkey"
      columns: ["reunion_id"]
isOneToOne: true
      referencedRelation: "mentores_reuniones"
      referencedColumns: ["id"]
    }
                  ]
                },"mentores_resumenes": {
                  Row: {
                    "asunto": string,"aviso": string | null,"aviso_util": boolean | null,"con_ia": boolean,"created_at": string,"email": string,"error": string | null,"estado": string,"html": string,"id": string,"leido_at": string | null,"programado_para": string | null,"resend_id": string | null,"reunion_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asunto": string,"aviso"?: string | null,"aviso_util"?: boolean | null,"con_ia": boolean,"created_at"?: string,"email": string,"error"?: string | null,"estado": string,"html": string,"id"?: string,"leido_at"?: string | null,"programado_para"?: string | null,"resend_id"?: string | null,"reunion_id": string
                  }
                  Update: {
                    "asunto"?: string,"aviso"?: string | null,"aviso_util"?: boolean | null,"con_ia"?: boolean,"created_at"?: string,"email"?: string,"error"?: string | null,"estado"?: string,"html"?: string,"id"?: string,"leido_at"?: string | null,"programado_para"?: string | null,"resend_id"?: string | null,"reunion_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mentores_resumenes_reunion_id_fkey"
      columns: ["reunion_id"]
isOneToOne: false
      referencedRelation: "mentores_reuniones"
      referencedColumns: ["id"]
    }
                  ]
                },"mentores_reuniones": {
                  Row: {
                    "cancelada": boolean,"cargada_por": string | null,"created_at": string,"feedback_pedido_at": string | null,"id": string,"inicio": string,"lugar": string | null,"mentor_id": string,"notas": string | null,"proximos_pasos": string | null,"proyecto_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelada"?: boolean,"cargada_por"?: string | null,"created_at"?: string,"feedback_pedido_at"?: string | null,"id"?: string,"inicio": string,"lugar"?: string | null,"mentor_id": string,"notas"?: string | null,"proximos_pasos"?: string | null,"proyecto_id": string,"updated_at"?: string
                  }
                  Update: {
                    "cancelada"?: boolean,"cargada_por"?: string | null,"created_at"?: string,"feedback_pedido_at"?: string | null,"id"?: string,"inicio"?: string,"lugar"?: string | null,"mentor_id"?: string,"notas"?: string | null,"proximos_pasos"?: string | null,"proyecto_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mentores_reuniones_cargada_por_fkey"
      columns: ["cargada_por"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mentores_reuniones_mentor_id_fkey"
      columns: ["mentor_id"]
isOneToOne: false
      referencedRelation: "personas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mentores_reuniones_proyecto_id_fkey"
      columns: ["proyecto_id"]
isOneToOne: false
      referencedRelation: "proyectos"
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
"jurado_criterios_aplicar":
{ Args: { "p_evento": string,"p_origen"?: string }; Returns: number
                           },
"jurado_criterios_fijar_usados":
{ Args: { "p_evento": string }; Returns: number
                           },
"jurado_evento_bloqueado":
{ Args: { "p_evento": string }; Returns: boolean
                           },
"jurado_evento_publicado":
{ Args: { "p_evento": string }; Returns: boolean
                           },
"jurado_guardar_salones":
{ Args: { "p_evento": string,"p_jurados": Json,"p_proyectos": Json }; Returns: undefined
                           },
"jurado_huella":
{ Args: { "p_evento": string,"p_proyecto": string }; Returns: string
                           },
"jurado_me_toca":
{ Args: { "p_evento": string,"p_proyecto": string }; Returns: boolean
                           },
"jurado_publicar_evento":
{ Args: { "p_evento": string }; Returns: number
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
