import { getPrograms, getStudents, getTrainingStats, getClients } from "./actions";
import { TrainingPage } from "./TrainingPage";

export default async function Page() {
  const [programs, students, stats, clients] = await Promise.all([
    getPrograms(),
    getStudents(),
    getTrainingStats(),
    getClients(),
  ]);

  return (
    <TrainingPage
      initialPrograms={programs}
      initialStudents={students}
      stats={stats}
      clients={clients}
    />
  );
}
