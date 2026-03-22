import { Suspense } from "react";
import { RevenueForecastSection } from "../components/RevenueForecastSection";
import { getRevenueForecast } from "../forecast-actions";

function RevenueForecastSkeleton() {
  return <div className="h-96 bg-surface rounded-xl animate-pulse" />;
}

async function RevenueForecastData() {
  const data = await getRevenueForecast();
  return <RevenueForecastSection data={data} />;
}

export function RevenueForecastSectionWrapper() {
  return (
    <Suspense fallback={<RevenueForecastSkeleton />}>
      <RevenueForecastData />
    </Suspense>
  );
}
