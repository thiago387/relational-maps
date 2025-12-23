import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Mail, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Email } from "@/types/graph";
import { ExpandableMessageCard } from "@/components/messages/ExpandableMessageCard";
import { MessageCard } from "@/components/messages/MessageCard";

export default function Messages() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const sender = searchParams.get("sender");
  const recipient = searchParams.get("recipient");
  const person = searchParams.get("person");

  useEffect(() => {
    async function loadEmails() {
      setLoading(true);
      
      let query = supabase.from("emails").select("*");
      
      if (sender && recipient) {
        query = query.or(
          `and(sender_id.eq.${sender},recipient.eq.${recipient}),and(sender_id.eq.${recipient},recipient.eq.${sender})`
        );
      } else if (person) {
        query = query.or(`sender_id.eq.${person},recipient.eq.${person}`);
      }
      
      query = query.order("date", { ascending: false }).limit(500);
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error loading emails:", error);
      } else {
        setEmails((data || []) as Email[]);
      }
      
      setLoading(false);
    }
    
    loadEmails();
  }, [sender, recipient, person]);

  const filteredEmails = emails.filter(email => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(query) ||
      email.body?.toLowerCase().includes(query) ||
      email.sender_id?.toLowerCase().includes(query) ||
      email.recipient?.toLowerCase().includes(query)
    );
  });

  const getTitle = () => {
    if (sender && recipient) {
      return `Messages between ${sender} and ${recipient}`;
    }
    if (person) {
      return `Messages for ${person}`;
    }
    return "All Messages";
  };

  const stats = {
    total: filteredEmails.length,
    positive: filteredEmails.filter(e => (e.polarity || 0) > 0.1).length,
    negative: filteredEmails.filter(e => (e.polarity || 0) < -0.1).length,
    neutral: filteredEmails.filter(e => (e.polarity || 0) >= -0.1 && (e.polarity || 0) <= 0.1).length,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Graph
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{getTitle()}</h1>
            <p className="text-muted-foreground text-sm">
              {stats.total} messages found
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.positive}</p>
                <p className="text-xs text-muted-foreground">Positive</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.negative}</p>
                <p className="text-xs text-muted-foreground">Negative</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Minus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.neutral}</p>
                <p className="text-xs text-muted-foreground">Neutral</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading messages...</div>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">No messages found</div>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-340px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {filteredEmails.map((email) => (
                <ExpandableMessageCard
                  key={email.id}
                  email={email}
                  onClick={() => setSelectedEmail(email)}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Expanded Message Dialog */}
        <Dialog open={!!selectedEmail} onOpenChange={(open) => !open && setSelectedEmail(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-lg font-semibold">
                {selectedEmail?.subject || "(No subject)"}
              </DialogTitle>
            </DialogHeader>
            {selectedEmail && (
              <div className="flex-1 overflow-hidden">
                <MessageCard email={selectedEmail} />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
