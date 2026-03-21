import Link from "next/link";
import { Inbox, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminInquiries } from "../admin-home-queries";
import { EmptyState } from "../components/AdminEmptyState";
import { InquiryRow } from "../components/AdminListRows";

export async function AdminInquiriesSection() {
  const { inquiries } = await getAdminInquiries();

  return (
    <Card className="xl:col-span-2 gap-0 py-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Inquiries</CardTitle>
          <Link href="/dashboard/inquiries" className="text-xs text-accent hover:underline flex items-center gap-0.5">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-2">
        {inquiries.length > 0 ? (
          inquiries.map((inquiry) => <InquiryRow key={inquiry.id} inquiry={inquiry} />)
        ) : (
          <EmptyState
            icon={Inbox}
            message="No open inquiries"
            detail="Inquiries from your website and social links show up here."
            actionLabel="View all"
            actionHref="/dashboard/inquiries"
          />
        )}
      </CardContent>
    </Card>
  );
}
