import { deleteSubscriptionByToken } from '@/lib/subscriptions';

export const dynamic = 'force-dynamic';

interface UnsubscribePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Layout>
        <h1 className="text-2xl font-semibold mb-2">Missing token</h1>
        <p className="text-muted-foreground">This unsubscribe link is incomplete. Use the link from the email footer.</p>
      </Layout>
    );
  }

  const result = await deleteSubscriptionByToken(token);

  if (!result) {
    return (
      <Layout>
        <h1 className="text-2xl font-semibold mb-2">Already unsubscribed</h1>
        <p className="text-muted-foreground">No active subscription matches that link. You won&apos;t receive further emails for that thread.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="text-2xl font-semibold mb-2">Unsubscribed</h1>
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">{result.email}</span> will no longer get emails for this thread.
      </p>
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 shadow-sm">{children}</div>
    </main>
  );
}
