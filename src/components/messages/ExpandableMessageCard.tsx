import { Calendar, User, Mail, Send, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Email } from "@/types/graph";

interface ExpandableMessageCardProps {
  email: Email;
  person?: string | null;
  onClick: () => void;
}

export function ExpandableMessageCard({ email, person, onClick }: ExpandableMessageCardProps) {
  const getSentimentVariant = (polarity: number | null): "default" | "secondary" | "destructive" => {
    if (polarity === null) return "secondary";
    if (polarity < -0.1) return "destructive";
    if (polarity > 0.1) return "default";
    return "secondary";
  };

  const getSentimentLabel = (polarity: number | null, category: string | null) => {
    if (category) return category;
    if (polarity === null) return "unknown";
    if (polarity < -0.1) return "negative";
    if (polarity > 0.1) return "positive";
    return "neutral";
  };

  // Determine if this email was sent or received by the person being viewed
  const isSent = person && email.sender_id === person;
  const isReceived = person && email.recipient === person;

  return (
    <Card 
      className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 bg-card"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Subject and badges row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground line-clamp-2 flex-1">
            {email.subject || "(No subject)"}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Direction badge - only show when viewing a specific person */}
            {person && (isSent || isReceived) && (
              <Badge 
                variant="outline" 
                className={`text-xs gap-1 ${
                  isSent 
                    ? "border-blue-500/50 text-blue-500 bg-blue-500/10" 
                    : "border-purple-500/50 text-purple-500 bg-purple-500/10"
                }`}
              >
                {isSent ? (
                  <>
                    <Send className="h-3 w-3" />
                    Sent
                  </>
                ) : (
                  <>
                    <Inbox className="h-3 w-3" />
                    Received
                  </>
                )}
              </Badge>
            )}
            <Badge variant={getSentimentVariant(email.polarity)} className="text-xs">
              {getSentimentLabel(email.polarity, email.sentiment_category)}
            </Badge>
          </div>
        </div>

        {/* From / To */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{email.sender_id || email.from_email}</span>
          </div>
          <span className="text-muted-foreground/50">→</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{email.recipient || "Unknown"}</span>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {email.date ? new Date(email.date).toLocaleDateString() : "Unknown date"}
        </div>

        {/* Preview snippet */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {email.message_clean || email.body || "(No content)"}
        </p>
      </CardContent>
    </Card>
  );
}
