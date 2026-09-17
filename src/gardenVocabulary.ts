export type GardenLanguage = 'es' | 'en';
type Group = 'content' | 'routine' | 'spaces' | 'states';
type Translation = { name: string; singular?: string; meaning: string };
type Term = { group: Group; planned?: boolean; es: Translation; en: Translation };

export const GARDEN_VOCABULARY = {
  idea: { group: 'content', es: { name: 'Semillas', singular: 'Semilla', meaning: 'Ideas que puedes explorar, sin obligación de convertirlas en proyectos.' }, en: { name: 'Seeds', singular: 'Seed', meaning: 'Ideas to explore, without having to turn them into projects.' } },
  note: { group: 'content', es: { name: 'Apuntes del jardín', singular: 'Apunte del jardín', meaning: 'Notas e información que quieres conservar.' }, en: { name: 'Garden notes', singular: 'Garden note', meaning: 'Notes and information you want to keep.' } },
  project: { group: 'content', es: { name: 'Brotes', singular: 'Brote', meaning: 'Proyectos que avanzan mediante pasos concretos.' }, en: { name: 'Sprouts', singular: 'Sprout', meaning: 'Projects that grow through specific steps.' } },
  task: { group: 'content', es: { name: 'Labores', singular: 'Labor', meaning: 'Tareas o pasos concretos de un proyecto.' }, en: { name: 'Garden tasks', singular: 'Garden task', meaning: 'Specific tasks or steps in a project.' } },
  goal: { group: 'content', es: { name: 'Frutos deseados', singular: 'Fruto deseado', meaning: 'Metas o resultados que te gustaría conseguir.' }, en: { name: 'Desired fruits', singular: 'Desired fruit', meaning: 'Goals or outcomes you would like to achieve.' } },
  cultivation: { group: 'content', planned: true, es: { name: 'Cultivos', singular: 'Cultivo', meaning: 'Prácticas repetidas durante una semana o un mes. Función por venir.' }, en: { name: 'Crops', singular: 'Crop', meaning: 'Repeated practices over a week or month. Coming later.' } },
  harvest: { group: 'content', es: { name: 'Cosechas', singular: 'Cosecha', meaning: 'Elementos terminados y logros que puedes reconocer.' }, en: { name: 'Harvests', singular: 'Harvest', meaning: 'Completed items and achievements to acknowledge.' } },
  learning: { group: 'content', es: { name: 'Aprendizajes de la cosecha', singular: 'Aprendizaje de la cosecha', meaning: 'Reflexiones y lecciones que decides conservar.' }, en: { name: 'Harvest lessons', singular: 'Harvest lesson', meaning: 'Reflections and lessons you choose to keep.' } },
  dailyFocus: { group: 'routine', es: { name: 'Mi labor de hoy', meaning: 'El único objetivo concreto que eliges priorizar hoy.' }, en: { name: 'My task today', meaning: 'The one specific goal you choose to prioritize today.' } },
  focus: { group: 'routine', es: { name: 'Manos a la tierra', meaning: 'Focus: un espacio para trabajar con atención, una acción a la vez.' }, en: { name: 'Hands in the soil', meaning: 'Focus: a space to work attentively, one action at a time.' } },
  plant: { group: 'routine', es: { name: 'Plantar', meaning: 'Capturar una nueva idea o apunte.' }, en: { name: 'Plant', meaning: 'Capture a new idea or garden note.' } },
  water: { group: 'routine', es: { name: 'Regar', meaning: 'Revisar y decidir cómo continúa algo. No significa completarlo.' }, en: { name: 'Water', meaning: 'Review an item and decide how it continues. It does not mean completing it.' } },
  recordCare: { group: 'routine', planned: true, es: { name: 'Registrar un cuidado', meaning: 'Confirmar una práctica realizada en un cultivo. Función por venir.' }, en: { name: 'Record care', meaning: 'Confirm a practice completed in a crop. Coming later.' } },
  complete: { group: 'routine', es: { name: 'Cosechar', meaning: 'Reconocer que un elemento terminó su ciclo.' }, en: { name: 'Harvest', meaning: 'Acknowledge that an item has completed its cycle.' } },
  journal: { group: 'routine', es: { name: 'Diario del jardinero', meaning: 'Tu experiencia personal, reflexiones y estado de ánimo.' }, en: { name: 'Gardener’s journal', meaning: 'Your personal experience, reflections and mood.' } },
  closeDay: { group: 'routine', es: { name: 'Dejar descansar el jardín', meaning: 'Cerrar el día, reconocer avances y preparar mañana.' }, en: { name: 'Let the garden rest', meaning: 'Close the day, acknowledge progress and prepare tomorrow.' } },
  garden: { group: 'spaces', es: { name: 'Mi jardín', meaning: 'Un espacio que reúne tus contenidos. Puedes separar Personal, Trabajo u otras áreas.' }, en: { name: 'My garden', meaning: 'A space for your content. Separate Personal, Work or other areas.' } },
  today: { group: 'spaces', es: { name: 'Un paseo por el jardín', meaning: 'La dashboard: lo importante, próximos compromisos y tu labor de hoy.' }, en: { name: 'A walk through the garden', meaning: 'The dashboard: priorities, upcoming commitments and today’s task.' } },
  upcoming: { group: 'spaces', es: { name: 'Próximas labores', meaning: 'Fechas y compromisos próximos, vencidos o importantes.' }, en: { name: 'Upcoming garden tasks', meaning: 'Upcoming, overdue or important dates and commitments.' } },
  inbox: { group: 'spaces', es: { name: 'El semillero', meaning: 'La bandeja de entrada: capturas que todavía no has organizado.' }, en: { name: 'The seedbed', meaning: 'The inbox: captures you have not organized yet.' } },
  board: { group: 'spaces', es: { name: 'La mesa del jardinero', meaning: 'La pizarra: reúne, organiza y conecta ideas sin duplicar las notas originales.' }, en: { name: 'The gardener’s table', meaning: 'The board: gather, organize and connect ideas without duplicating original notes.' } },
  shed: { group: 'spaces', es: { name: 'El cobertizo', meaning: 'Cosas guardadas para después. Descansar no es fracasar ni eliminar.' }, en: { name: 'The shed', meaning: 'Things saved for later. Rest is not failure or deletion.' } },
  calendar: { group: 'spaces', es: { name: 'Calendario del jardín', meaning: 'Fechas previstas e historial de actividad real.' }, en: { name: 'Garden calendar', meaning: 'Planned dates and a history of real activity.' } },
  season: { group: 'spaces', planned: true, es: { name: 'Temporadas', singular: 'Temporada', meaning: 'Ciclos semanales o mensuales de tus cultivos. Función por venir.' }, en: { name: 'Seasons', singular: 'Season', meaning: 'Weekly or monthly crop cycles. Coming later.' } },
  gardenView: { group: 'spaces', es: { name: 'Vista del jardín', meaning: 'Una representación visual de lo que estás desarrollando.' }, en: { name: 'Garden view', meaning: 'A visual representation of what you are developing.' } },
  planetView: { group: 'spaces', es: { name: 'Mi pequeño mundo', meaning: 'La vista planeta: una representación tridimensional de tu jardín.' }, en: { name: 'My little world', meaning: 'The planet view: a three-dimensional representation of your garden.' } },
  seedStage: { group: 'states', es: { name: 'Por germinar', meaning: 'Todavía no lo has desarrollado en pasos.' }, en: { name: 'Waiting to sprout', meaning: 'Not yet developed into steps.' } },
  growingStage: { group: 'states', es: { name: 'En crecimiento', meaning: 'Está desarrollado y avanzando.' }, en: { name: 'Growing', meaning: 'Developed and moving forward.' } },
  attention: { group: 'states', es: { name: 'Necesita atención', meaning: 'Hay algo pendiente de revisar. No es una penalización.' }, en: { name: 'Needs attention', meaning: 'Something is ready for review. It is not a penalty.' } },
  currentCare: { group: 'states', es: { name: 'Cuidado por hoy', meaning: 'No necesita revisión ahora; no implica que lo hayas regado físicamente ni completado.' }, en: { name: 'Cared for today', meaning: 'No review is due now; this does not mean physically watering or completing it.' } },
  rest: { group: 'states', es: { name: 'En reposo', meaning: 'Está pausado o guardado para después.' }, en: { name: 'Resting', meaning: 'Paused or saved for later.' } },
  harvestReady: { group: 'states', es: { name: 'Listo para cosechar', meaning: 'Puedes decidir reconocer su cierre. No se asigna automáticamente por una fecha.' }, en: { name: 'Ready to harvest', meaning: 'You can choose to acknowledge its closure. A date alone never assigns this state.' } },
  harvested: { group: 'states', es: { name: 'Cosechado', meaning: 'Ya está terminado. Sus aprendizajes son opcionales.' }, en: { name: 'Harvested', meaning: 'Completed. Keeping lessons is optional.' } },
} as const satisfies Record<string, Term>;

export type GardenTermId = keyof typeof GARDEN_VOCABULARY;
export function gardenName(id: GardenTermId, language: GardenLanguage, singular = false): string {
  const term: Translation = GARDEN_VOCABULARY[id][language];
  return singular ? term.singular || term.name : term.name;
}
export function gardenStageName(stage: 'seed' | 'sprout' | 'bloom' | 'withered', language: GardenLanguage): string {
  const terms = { seed: 'seedStage', sprout: 'growingStage', bloom: 'harvested', withered: 'attention' } as const;
  return gardenName(terms[stage], language);
}
export function gardenTypeName(type: 'idea' | 'project' | 'goal' | 'learning', language: GardenLanguage): string {
  return gardenName(type, language, true);
}
