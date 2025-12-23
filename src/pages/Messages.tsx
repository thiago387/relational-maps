import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter, Mail, Calendar, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import type { Email } from "@/types/graph";
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
        // Edge click - messages between two people
        query = query.or(
          `and(sender_id.eq.${sender},recipient.eq.${recipient}),and(sender_id.eq.${recipient},recipient.eq.${sender})`
        );
      } else if (person) {
        // Node click - all messages for a person
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

  const getSentimentBadge = (polarity: number | null, category: string | null) => {
    if (polarity === null) return null;
    
    let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
    let label = category || "neutral";
    
    if (polarity < -0.1) {
      variant = "destructive";
      label = category || "negative";
    } else if (polarity > 0.1) {
      variant = "default";
      label = category || "positive";
    }
    
    return (
      <Badge variant={variant} className="text-xs">
        {label} ({polarity.toFixed(2)})
      </Badge>
    );
  };

  const stats = {
    total: filteredEmails.length,
    positive: filteredEmails.filter(e => (e.polarity || 0) > 0.1).length,
    negative: filteredEmails.filter(e => (e.polarity || 0) < -0.1).length,
    neutral: filteredEmails.filter(e => (e.polarity || 0) >= -0.1 && (e.polarity || 0) <= 0.1).length,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{getTitle()}</h1>
            <p className="text-muted-foreground text-sm">
              {stats.total} messages found
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.positive}</p>
                <p className="text-xs text-muted-foreground">Positive</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-red-500 rotate-180" />
              <div>
                <p className="text-2xl font-bold">{stats.negative}</p>
                <p className="text-xs text-muted-foreground">Negative</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.neutral}</p>
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

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Messages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Loading messages...
                  </div>
                ) : filteredEmails.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No messages found
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredEmails.map((email) => (
                      <div
                        key={email.id}
                        className={`p-4 cursor-pointer hover:bg-accent/50 transition-colors ${
                          selectedEmail?.id === email.id ? "bg-accent" : ""
                        }`}
                        onClick={() => setSelectedEmail(email)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-foreground">
                              {email.subject || "(No subject)"}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {email.sender_id} → {email.recipient}
                            </p>
                          </div>
                          {getSentimentBadge(email.polarity, email.sentiment_category)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {email.date ? new Date(email.date).toLocaleDateString() : "Unknown date"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Email Detail */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Message Detail</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedEmail ? (
                <MessageCard email={selectedEmail} />
              ) : (
                <div className="h-[600px] flex items-center justify-center text-muted-foreground">
                  Select a message to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
