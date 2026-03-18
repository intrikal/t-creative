import { getWaiverPageData } from "../actions";
import { WaiverCompletionPage } from "./WaiverCompletionPage";

export const metadata = {
  title: "Complete Your Waiver — T Creative Studio",
};

export default async function WaiverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getWaiverPageData(token);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#faf6f1] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Link Expired or Invalid</h1>
          <p className="text-sm text-stone-500">
            This waiver link is no longer valid. It may have expired or already been used. Please
            contact the studio for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (data.forms.length === 0) {
    return (
      <div className="min-h-screen bg-[#faf6f1] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">All Waivers Completed</h1>
          <p className="text-sm text-stone-500">
            You&apos;ve already completed all required waivers for your {data.serviceName}{" "}
            appointment. No further action is needed.
          </p>
        </div>
      </div>
    );
  }

  return <WaiverCompletionPage data={data} token={token} />;
}
