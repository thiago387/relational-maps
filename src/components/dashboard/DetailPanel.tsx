import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { X, Mail, User, ArrowRight, ArrowLeft, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import type { GraphNode, GraphLink, Email, Person, Relationship } from '@/types/graph';
import { getSentimentColor, getCommunityColor } from '@/lib/api/graph';
import { format } from 'date-fns';

interface DetailPanelProps {
  selectedNode: GraphNode | null;
  selectedLink: GraphLink | null;
  persons: Person[];
  relationships: Relationship[];
  emails: Email[];
  onClose: () => void;
  onViewMessages?: (person?: string, sender?: string, recipient?: string) => void;
}

export function DetailPanel({
  selectedNode,
  selectedLink,
  persons,
  relationships,
  emails,
  onClose,
  onViewMessages,
}: DetailPanelProps) {
  if (!selectedNode && !selectedLink) return null;

  return (
    <Card className="absolute bottom-4 right-4 w-96 max-h-[60%] bg-card/95 backdrop-blur border shadow-xl z-10">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold">
          {selectedNode ? 'Person Details' : 'Relationship Details'}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="max-h-[400px]">
        {selectedNode && (
          <PersonDetail 
            node={selectedNode} 
            relationships={relationships}
            persons={persons}
            emails={emails}
            onViewMessages={onViewMessages}
          />
        )}
        {selectedLink && (
          <RelationshipDetail 
            link={selectedLink}
            persons={persons}
            emails={emails}
            onViewMessages={onViewMessages}
          />
        )}
      </ScrollArea>
    </Card>
  );
}

function PersonDetail({ 
  node, 
  relationships, 
  persons,
  emails,
  onViewMessages,
}: { 
  node: GraphNode; 
  relationships: Relationship[];
  persons: Person[];
  emails: Email[];
  onViewMessages?: (person?: string, sender?: string, recipient?: string) => void;
}) {
  const person = persons.find(p => p.id === node.id);
  
  // Get relationships for this person
  const personRelationships = relationships
    .filter(r => r.person_a_id === node.id || r.person_b_id === node.id)
    .map(r => {
      const isPersonA = r.person_a_id === node.id;
      const otherId = isPersonA ? r.person_b_id : r.person_a_id;
      const otherPerson = persons.find(p => p.id === otherId);
      
      return {
        ...r,
        otherPerson,
        emailsSent: isPersonA ? r.emails_a_to_b : r.emails_b_to_a,
        emailsReceived: isPersonA ? r.emails_b_to_a : r.emails_a_to_b,
        sentimentSent: isPersonA ? r.sentiment_a_to_b : r.sentiment_b_to_a,
        sentimentReceived: isPersonA ? r.sentiment_b_to_a : r.sentiment_a_to_b,
      };
    })
    .sort((a, b) => (b.emailsSent + b.emailsReceived) - (a.emailsSent + a.emailsReceived))
    .slice(0, 10);

  // Get emails for this person (using sender_id for pre-computed data)
  const personEmails = emails
    .filter(e => 
      e.sender_id === node.id || 
      e.recipient === node.id ||
      e.from_email?.toLowerCase() === node.email?.toLowerCase() ||
      e.to_emails?.some(t => t.toLowerCase() === node.email?.toLowerCase())
    )
    .slice(0, 20);

  return (
    <Tabs defaultValue="overview" className="p-4">
      <TabsList className="w-full">
        <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
        <TabsTrigger value="contacts" className="flex-1">Contacts</TabsTrigger>
        <TabsTrigger value="emails" className="flex-1">Emails</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4 mt-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: node.color }}
          >
            {node.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 className="font-semibold">{node.name}</h4>
            <p className="text-sm text-muted-foreground">{node.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-xs text-muted-foreground">Total Emails</p>
            <p className="text-lg font-bold">{node.emailCount || person?.email_count_sent || 0}</p>
          </div>
          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-xs text-muted-foreground">Connections</p>
            <p className="text-lg font-bold">{personRelationships.length}</p>
          </div>
        </div>

        {node.avgSentiment !== null && (
          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-xs text-muted-foreground mb-1">Average Sentiment</p>
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: getSentimentColor(node.avgSentiment) }}
              />
              <span className="font-medium">
                {node.avgSentiment > 0 ? '+' : ''}{node.avgSentiment.toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">
                ({node.avgSentiment > 0.3 ? 'Positive' : node.avgSentiment < -0.3 ? 'Negative' : 'Neutral'})
              </span>
            </div>
          </div>
        )}

        {node.communityId !== null && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Community:</span>
            <Badge 
              style={{ 
                backgroundColor: getCommunityColor(node.communityId),
                color: 'white'
              }}
            >
              #{node.communityId}
            </Badge>
          </div>
        )}

        {onViewMessages && (
          <Button 
            onClick={() => onViewMessages(node.id)} 
            className="w-full"
            variant="outline"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View All Messages
          </Button>
        )}
      </TabsContent>

      <TabsContent value="contacts" className="mt-4">
        <div className="space-y-2">
          {personRelationships.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No contacts found</p>
          ) : (
            personRelationships.map(rel => (
              <div key={rel.id} className="bg-muted/30 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">
                    {rel.otherPerson?.name || rel.otherPerson?.email?.split('@')[0] || 'Unknown'}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {rel.emailsSent + rel.emailsReceived} emails
                  </Badge>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {rel.emailsSent} sent
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" />
                    {rel.emailsReceived} received
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </TabsContent>

      <TabsContent value="emails" className="mt-4">
        <div className="space-y-2">
          {personEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No emails found</p>
          ) : (
            personEmails.map(email => (
              <div key={email.id} className="bg-muted/30 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  {(email.polarity ?? email.sentiment_score) !== null && (
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getSentimentColor(email.polarity ?? email.sentiment_score) }}
                    />
                  )}
                  <span className="font-medium text-sm truncate flex-1">
                    {email.subject || '(No subject)'}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{email.date ? format(new Date(email.date), 'MMM d, yyyy') : 'Unknown date'}</span>
                  {email.sentiment_category && (
                    <Badge variant="outline" className="text-xs">
                      {email.sentiment_category}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function RelationshipDetail({ 
  link, 
  persons,
  emails,
  onViewMessages,
}: { 
  link: GraphLink;
  persons: Person[];
  emails: Email[];
  onViewMessages?: (person?: string, sender?: string, recipient?: string) => void;
}) {
  const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
  const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
  
  const personA = persons.find(p => p.id === sourceId);
  const personB = persons.find(p => p.id === targetId);

  // For pre-computed edges, source/target are the person IDs directly
  const senderName = personA?.name || sourceId;
  const recipientName = personB?.name || targetId;

  // Get emails between these two people
  const relationshipEmails = emails
    .filter(e => {
      // Check using sender_id/recipient for pre-computed data
      const matchForward = e.sender_id === sourceId && e.recipient === targetId;
      const matchBackward = e.sender_id === targetId && e.recipient === sourceId;
      
      // Also check legacy email fields
      const fromMatch = [personA?.email, personB?.email].filter(Boolean).includes(e.from_email?.toLowerCase());
      const toMatch = e.to_emails?.some(t => 
        [personA?.email, personB?.email].filter(Boolean).includes(t.toLowerCase())
      );
      
      return matchForward || matchBackward || (fromMatch && toMatch);
    })
    .slice(0, 20);

  const totalEmails = link.emailsAtoB + link.emailsBtoA;
  const dominantDirection = link.emailsAtoB > link.emailsBtoA ? 'A→B' : 'B→A';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-center gap-3">
        <div className="text-center">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-1"
            style={{ backgroundColor: getCommunityColor(personA?.community_id ?? null) }}
          >
            {senderName?.charAt(0) || 'A'}
          </div>
          <p className="text-xs font-medium truncate max-w-[80px]">{senderName}</p>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="h-px bg-border flex-1" />
          <div className="px-2 text-xs text-muted-foreground">{totalEmails} emails</div>
          <div className="h-px bg-border flex-1" />
        </div>
        
        <div className="text-center">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-1"
            style={{ backgroundColor: getCommunityColor(personB?.community_id ?? null) }}
          >
            {recipientName?.charAt(0) || 'B'}
          </div>
          <p className="text-xs font-medium truncate max-w-[80px]">{recipientName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-md p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">
            {senderName?.split(' ')[0] || 'A'} → {recipientName?.split(' ')[0] || 'B'}
          </p>
          <p className="text-lg font-bold">{link.emailsAtoB}</p>
          {link.sentimentAtoB !== null && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getSentimentColor(link.sentimentAtoB) }}
              />
              <span className="text-xs">{link.sentimentAtoB.toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="bg-muted/50 rounded-md p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">
            {recipientName?.split(' ')[0] || 'B'} → {senderName?.split(' ')[0] || 'A'}
          </p>
          <p className="text-lg font-bold">{link.emailsBtoA}</p>
          {link.sentimentBtoA !== null && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getSentimentColor(link.sentimentBtoA) }}
              />
              <span className="text-xs">{link.sentimentBtoA.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {link.avgPolarity !== null && (
        <div className="bg-muted/50 rounded-md p-3">
          <p className="text-xs text-muted-foreground mb-1">
            Weighted Average Polarity
            {link.mergedEdgeCount && link.mergedEdgeCount > 1 && (
              <span className="ml-1 text-primary">
                (from {link.mergedEdgeCount} data points)
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: getSentimentColor(link.avgPolarity) }}
            />
            <span className="font-medium">
              {link.avgPolarity > 0 ? '+' : ''}{link.avgPolarity.toFixed(3)}
            </span>
            {link.edgeSentiment && (
              <Badge variant="outline" className="text-xs">
                {link.edgeSentiment}
              </Badge>
            )}
          </div>
          {totalEmails < 3 && (
            <p className="text-xs text-amber-500 mt-1">⚠ Low data - sentiment may be less reliable</p>
          )}
        </div>
      )}

      {onViewMessages && (
        <Button 
          onClick={() => onViewMessages(undefined, sourceId, targetId)} 
          className="w-full"
          variant="outline"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View All Messages
        </Button>
      )}

      <div>
        <h4 className="text-sm font-medium mb-2">Recent Emails</h4>
        <div className="space-y-2 max-h-40 overflow-auto">
          {relationshipEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No emails found</p>
          ) : (
            relationshipEmails.map(email => (
              <div key={email.id} className="bg-muted/30 rounded-md p-2">
                <div className="flex items-center gap-2">
                  {(email.polarity ?? email.sentiment_score) !== null && (
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getSentimentColor(email.polarity ?? email.sentiment_score) }}
                    />
                  )}
                  <span className="text-xs truncate">
                    {email.subject || '(No subject)'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
