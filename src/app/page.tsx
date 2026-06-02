"use client";

import { useAuth } from "@/contexts/auth-context";
import { LinearIssueForm } from "@/components/linear-issue-form";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
  Github,
  MessageSquare,
  Share2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProductPreview } from "@/components/product-preview";
import { KanbanMockup } from "@/components/mockups/kanban-mockup";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Check if user has Linear API token set up
  const [hasLinearToken, setHasLinearToken] = useState<boolean | null>(null);
  const [hideOnboarding, setHideOnboarding] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkLinearToken = async () => {
      try {
        // Check if a Linear token is available (workspace-shared or personal)
        const res = await fetch("/api/linear/token-status");
        if (res.ok) {
          const { hasToken } = (await res.json()) as { hasToken: boolean };
          setHasLinearToken(hasToken);
        } else {
          setHasLinearToken(false);
        }

        // Also fetch the hide_onboarding preference from the user's profile
        const { data, error } = await supabase
          .from("profiles")
          .select("hide_onboarding")
          .eq("id", user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error loading profile:", error);
        } else {
          setHideOnboarding(data?.hide_onboarding ?? false);
        }
      } catch (error) {
        console.error("Error checking Linear token:", error);
        setHasLinearToken(false);
      }
    };

    checkLinearToken();
  }, [user]);

  // Redirect authenticated users with token to public views
  useEffect(() => {
    if (hasLinearToken === true) {
      router.replace("/views");
    }
  }, [hasLinearToken, router]);

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg">
        <Navigation />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
            <p className="text-muted-foreground">
              Please wait while we load your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen gradient-bg">
        <Navigation />

        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-24 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <Badge
                variant="secondary"
                className="mb-8 px-4 py-2 bg-primary/10 text-primary border-primary/20"
              >
                <Github className="h-4 w-4 mr-2" />
                Available on GitHub
              </Badge>

              <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent leading-tight">
                Linear issues shared
                <br />
                <span className="text-primary">with Dude clients.</span>
              </h1>

              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                See your tasks being worked on in real time.
              </p>
            </div>

            {/* Product Preview */}
            <div className="mb-12">
              <ProductPreview>
                <KanbanMockup />
              </ProductPreview>
            </div>

          </div>
        </section>

        {/* How it works */}
        <section className="container mx-auto px-6 py-20 bg-muted/20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Two ways to make Linear accessible
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Share your Linear workspace with the world in minutes - no technical setup required
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Public Views */}
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="blue">
                      Live now
                    </Badge>
                    <Share2 className="h-8 w-8 text-blue-500" />
                  </div>
                  <CardTitle className="text-2xl mb-2">Public read-only views</CardTitle>
                  <CardDescription className="text-base">
                    Share live Linear boards with clients, stakeholders, and users
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Beautiful Kanban board view of your Linear projects or teams</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Real-time updates - no manual refreshing needed</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Filter by status, assignee, priority, and labels</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Optional password protection for sensitive projects</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Allow viewers to create issues directly from the board</p>
                  </div>
                </CardContent>
              </Card>

              {/* Feedback Forms */}
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="green">
                      Live now
                    </Badge>
                    <MessageSquare className="h-8 w-8 text-green-500" />
                  </div>
                  <CardTitle className="text-2xl mb-2">Customer feedback forms</CardTitle>
                  <CardDescription className="text-base">
                    Let anyone submit feedback directly to your Linear projects
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Custom forms for different Linear projects and use cases</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Submissions automatically create Linear issues with full context</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Support for attachments, reference IDs, and custom fields</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Prefill form fields via URL for specific customers</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Perfect for support requests, bug reports, and feature requests</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

      </div>
    );
  }

  if (hasLinearToken === null || hasLinearToken === true) {
    return (
      <div className="min-h-screen gradient-bg">
        <Navigation />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
            <p className="text-muted-foreground">
              Checking your Linear configuration...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasLinearToken) {
    return (
      <div className="min-h-screen gradient-bg">
        <Navigation />
        <div className="container mx-auto px-6 py-12">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Welcome to Linear integration
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Let&apos;s get you set up to start collecting customer feedback
                directly in Linear.
              </p>
            </div>

            {/* Setup Flow */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg mb-8">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  Set up your Linear API token
                </CardTitle>
                <CardDescription className="text-base">
                  This is the first step to connect your Linear workspace with
                  our integration.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                  <h3 className="font-semibold mb-2">
                    How to get your Linear API token:
                  </h3>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Go to Linear → Settings → API</li>
                    <li>Click &quot;Create personal API key&quot;</li>
                    <li>Give it a name like &quot;Linear Integration&quot;</li>
                    <li>Copy the generated token</li>
                  </ol>
                </div>

                <div className="flex justify-center">
                  <Button asChild size="lg" className="h-12 px-8 font-semibold">
                    <Link href="/profile">Set up Linear API token</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* What's Next Preview */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg opacity-60">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted-foreground text-background rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  What you&apos;ll be able to do next
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg border border-border/30">
                    <h4 className="font-semibold mb-2">
                      Quick customer requests
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Submit one-off customer requests directly to Linear
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg border border-border/30">
                    <h4 className="font-semibold mb-2">Shareable forms</h4>
                    <p className="text-sm text-muted-foreground">
                      Create branded forms for specific projects that customers
                      can use
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      <div className="container mx-auto px-6 py-12">
        {/* Hero section */}
        {!hideOnboarding && (
        <div className="max-w-4xl mx-auto mb-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Linear integration
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Your Linear API token is configured! Now you can create customer
              requests and manage custom forms effortlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:border-primary/20">
              <CardHeader className="space-y-3">
                <CardTitle className="text-xl">
                  Create customer request
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Submit a one-off customer request to Linear directly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full h-11 font-medium">
                  <Link href="#form">Use quick form below</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:border-primary/20">
              <CardHeader className="space-y-3">
                <CardTitle className="text-xl">Manage custom forms</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Create shareable forms with pre-defined projects and titles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  asChild
                  variant="outline"
                  className="w-full h-11 font-medium"
                >
                  <Link href="/forms">Manage forms</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-6">
            <button
              onClick={async () => {
                setHideOnboarding(true);
                if (user) {
                  await supabase
                    .from("profiles")
                    .update({ hide_onboarding: true })
                    .eq("id", user.id);
                }
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Hide this section
            </button>
          </div>
        </div>
        )}

        <div id="form" className="max-w-2xl mx-auto">
          <LinearIssueForm />
        </div>
      </div>
    </div>
  );
}
