import { Suspense } from "react";
import {
  getPrograms,
  getStudents,
  getTrainingStats,
  getClients,
} from "../../training/actions";
import { TrainingPage } from "../../training/TrainingPage";

function TrainingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-surface rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-48 bg-surface rounded-xl animate-pulse" />
    </div>
  );
}

async function TrainingData() {
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
      embedded
    />
  );
}

export function TrainingSection() {
  return (
    <Suspense fallback={<TrainingSkeleton />}>
      <TrainingData />
    </Suspense>
  );
}
