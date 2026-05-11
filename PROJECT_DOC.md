# Informe Técnico: CloudStock Pro
**Empresa:** CloudSolutions SPA  
**Proyecto:** Gestión de Inventario Cloud  
**Fecha:** Mayo 2026

## 1. Introducción
Este documento describe la implementación de la plataforma "CloudStock Pro", una solución robusta para la gestión de inventario de infraestructura cloud. El proyecto nace de la necesidad de CloudSolutions SPA de centralizar el control de sus activos tecnológicos mediante una arquitectura resiliente, segura y escalable en la nube de AWS.

## 2. Arquitectura de la Solución
La infraestructura se basa en un modelo de **Infraestructura como Código (IaC)** simplificado mediante Docker Compose, desplegado sobre una instancia **AWS EC2**.

- **Capa de Presentación**: Interfaz web reactiva con diseño Glassmorphism.
- **Capa de Lógica**: API RESTful construida en Node.js.
- **Capa de Datos**: Motor PostgreSQL con persistencia de datos montada en volúmenes de EBS (Elastic Block Store).
- **Seguridad**: Implementación de Security Groups y usuarios no root en contenedores.

## 3. Tecnologías Utilizadas
- **Nube**: AWS (EC2, VPC, Security Groups).
- **Contenedores**: Docker (Dockerfile multi-stage) y Docker Compose.
- **Backend**: Node.js v20, Express, `node-postgres`.
- **Base de Datos**: PostgreSQL 15.
- **Frontend**: HTML5, Vanilla CSS3 (Custom Variables), JavaScript ES6.

## 4. Implementación y Despliegue
El despliegue se realiza siguiendo el flujo:
1. Provisión de instancia EC2 (t3.micro).
2. Instalación de Docker Runtime.
3. Transferencia de código (Git/SCP).
4. Ejecución de `docker-compose up -d`.
5. La aplicación expone el puerto 80 mediante mapeo de puertos de Docker hacia el puerto interno 3000.

## 5. Seguridad
- **Aislamiento de Puertos**: Solo el puerto 80 (HTTP) y 22 (SSH con llave RSA) están abiertos al exterior.
- **Principio de Menor Privilegio**: La aplicación en el contenedor no tiene permisos de root en el sistema operativo host.
- **Gestión de Secretos**: Uso de archivos `.env` para credenciales de base de datos.

## 6. DRP (Disaster Recovery Plan)
### Escenario: Caída Total del Servidor
- **Estrategia de Respaldo**: Snapshots diarios de la instancia EC2 y volúmenes EBS.
- **Procedimiento de Recuperación**:
  1. Lanzar nueva instancia desde el último Snapshot exitoso.
  2. Reasignar Elastic IP para mantener la URL de acceso.
  3. Verificar integridad de la base de datos PostgreSQL.
- **RTO (Recovery Time Objective)**: 15 minutos.
- **RPO (Recovery Point Objective)**: 24 horas (basado en el último snapshot).

## 7. BCP (Business Continuity Plan)
### Mantenimiento de la Continuidad Operacional
- **Riesgo Identificado**: Corrupción de base de datos.
  - *Mitigación*: Volúmenes Docker persistentes y backups lógicos (`pg_dump`) exportados a S3.
- **Riesgo Identificado**: Saturación de recursos (CPU/RAM).
  - *Mitigación*: Alarmas de CloudWatch para notificar uso > 80% y escalamiento manual a t3.small.
- **Dependencias Críticas**: Conectividad a Internet y disponibilidad de AWS US-East-1.

## 8. Costos Aproximados (Mensual AWS)
| Servicio | Configuración | Costo Est. (USD) |
| :--- | :--- | :--- |
| **EC2** | t3.micro (On-demand) | $9.50 |
| **EBS** | 20GB gp3 | $1.60 |
| **Data Transfer** | 10GB Outbound | $0.90 |
| **Total Estimado** | | **$12.00 / mes** |

## 9. Conclusiones
La solución implementada cumple con los requerimientos de CloudSolutions SPA al integrar contenedores para la portabilidad y AWS para la escalabilidad. El mayor desafío fue la configuración del healthcheck de la base de datos para asegurar que la aplicación inicie solo cuando el motor esté listo, garantizando la estabilidad del sistema.
