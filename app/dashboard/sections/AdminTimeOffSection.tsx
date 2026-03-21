import { AdminTimeOffQueue } from "../components/AdminTimeOffQueue";
import { getPendingTimeOffRequests } from "../time-off-actions";

export async function AdminTimeOffSection() {
  const requests = await getPendingTimeOffRequests();
  return <AdminTimeOffQueue requests={requests} />;
}
