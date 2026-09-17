# El lenguaje del jardinero

Los nombres visibles proceden de `src/gardenVocabulary.ts`, con versiones en español e inglés. Ajustes incluye un glosario desplegable para consultar todas las metáforas sin añadir otra tarjeta a la dashboard.

| Función | Nombre |
| --- | --- |
| Ideas | Semillas |
| Notas | Apuntes del jardín |
| Proyectos | Brotes |
| Tareas | Labores |
| Metas | Frutos deseados |
| Elementos terminados | Cosechas |
| Reflexiones y lecciones | Aprendizajes de la cosecha |
| Objetivo diario | Mi labor de hoy |
| Focus | Manos a la tierra |
| Capturar | Plantar |
| Revisar y decidir | Regar |
| Completar un elemento | Cosechar |
| Reflexión personal | Diario del jardinero |
| Cierre del día | Dejar descansar el jardín |
| Espacio de contenido | Mi jardín |
| Dashboard | Un paseo por el jardín |
| Próximos compromisos | Próximas labores |
| Bandeja de entrada | El semillero |
| Pizarra | La mesa del jardinero |
| Guardado para después | El cobertizo |
| Fechas e historial | Calendario del jardín |
| Representación del progreso | Vista del jardín |
| Vista planeta 3D | Mi pequeño mundo |

## Estados

Por germinar, En crecimiento, Necesita atención, Cuidado por hoy, En reposo, Listo para cosechar y Cosechado.

- La gotita azul indica que hay una revisión pendiente; el sol amarillo indica que no necesita revisión ahora. Cuidado por hoy no afirma que se haya regado hoy ni que esté terminado.
- Regar no completa tareas. Una labor realizada no cosecha automáticamente todo el brote.
- Listo para cosechar explica la decisión de cierre; no añade un estado persistido ni se asigna por llegar a una fecha.
- Descansar no elimina contenido ni representa un fracaso.

## Vocabulario reservado

Cultivos (prácticas repetidas), Registrar un cuidado (confirmar una práctica) y Temporadas (ciclos semanales o mensuales) aparecen como **Por venir** únicamente en el glosario. Este cambio no implementa esa funcionalidad.

## Compatibilidad

Solo cambia el lenguaje de la interfaz: se conservan rutas internas, IDs de módulos, preferencias de orden y visibilidad, claves de almacenamiento y tipos/estados de las notas. No se migra ni reescribe el contenido del usuario. Se mantienen explicaciones funcionales y etiquetas cortas en controles estrechos.
