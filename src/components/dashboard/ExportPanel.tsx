import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileJson, FileSpreadsheet, Image } from 'lucide-react';
import type { GraphData, Person, Relationship, Email } from '@/types/graph';

interface ExportPanelProps {
  graphData: GraphData;
  persons: Person[];
  relationships: Relationship[];
  emails: Email[];
}

export function ExportPanel({ graphData, persons, relationships, emails }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);

  const downloadJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const value = row[h];
          if (value === null || value === undefined) return '';
          if (Array.isArray(value)) return `"${value.join('; ')}"`;
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportGraphData = () => {
    downloadJSON({
      nodes: graphData.nodes,
      links: graphData.links.map(l => ({
        source: typeof l.source === 'string' ? l.source : (l.source as any).id,
        target: typeof l.target === 'string' ? l.target : (l.target as any).id,
        ...l,
      })),
    }, 'epstein-network-graph.json');
  };

  const exportPersons = (format: 'json' | 'csv') => {
    if (format === 'json') {
      downloadJSON(persons, 'epstein-persons.json');
    } else {
      downloadCSV(persons, 'epstein-persons.csv');
    }
  };

  const exportRelationships = (format: 'json' | 'csv') => {
    const enrichedRelationships = relationships.map(r => {
      const personA = persons.find(p => p.id === r.person_a_id);
      const personB = persons.find(p => p.id === r.person_b_id);
      return {
        ...r,
        person_a_name: personA?.name || personA?.email,
        person_b_name: personB?.name || personB?.email,
      };
    });

    if (format === 'json') {
      downloadJSON(enrichedRelationships, 'epstein-relationships.json');
    } else {
      downloadCSV(enrichedRelationships, 'epstein-relationships.csv');
    }
  };

  const exportEmails = (format: 'json' | 'csv') => {
    const exportData = emails.map(e => ({
      ...e,
      to_emails: e.to_emails?.join('; '),
      cc_emails: e.cc_emails?.join('; '),
      emotional_markers: e.emotional_markers?.join('; '),
      topics: e.topics?.join('; '),
    }));

    if (format === 'json') {
      downloadJSON(emails, 'epstein-emails.json');
    } else {
      downloadCSV(exportData, 'epstein-emails.csv');
    }
  };

  const exportSummary = () => {
    const summary = {
      exportDate: new Date().toISOString(),
      statistics: {
        totalEmails: emails.length,
        analyzedEmails: emails.filter(e => e.is_analyzed).length,
        totalPersons: persons.length,
        totalRelationships: relationships.length,
        communities: new Set(persons.map(p => p.community_id).filter(c => c !== null)).size,
      },
      sentimentDistribution: {
        positive: emails.filter(e => (e.sentiment_score || 0) > 0.3).length,
        neutral: emails.filter(e => Math.abs(e.sentiment_score || 0) <= 0.3).length,
        negative: emails.filter(e => (e.sentiment_score || 0) < -0.3).length,
      },
      topSenders: persons
        .sort((a, b) => b.email_count_sent - a.email_count_sent)
        .slice(0, 10)
        .map(p => ({ name: p.name, email: p.email, emailsSent: p.email_count_sent })),
      topRecipients: persons
        .sort((a, b) => b.email_count_received - a.email_count_received)
        .slice(0, 10)
        .map(p => ({ name: p.name, email: p.email, emailsReceived: p.email_count_received })),
      strongestConnections: relationships
        .map(r => ({
          personA: persons.find(p => p.id === r.person_a_id)?.name,
          personB: persons.find(p => p.id === r.person_b_id)?.name,
          totalEmails: r.emails_a_to_b + r.emails_b_to_a,
          avgSentiment: ((r.sentiment_a_to_b || 0) + (r.sentiment_b_to_a || 0)) / 2,
        }))
        .sort((a, b) => b.totalEmails - a.totalEmails)
        .slice(0, 10),
    };

    downloadJSON(summary, 'epstein-analysis-summary.json');
  };

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Export Data</h3>

      <div className="space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Download className="h-4 w-4 mr-2" />
              Export Graph
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={exportGraphData}>
              <FileJson className="h-4 w-4 mr-2" />
              Graph Data (JSON)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Download className="h-4 w-4 mr-2" />
              Export Persons
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => exportPersons('json')}>
              <FileJson className="h-4 w-4 mr-2" />
              JSON Format
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportPersons('csv')}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              CSV Format
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Download className="h-4 w-4 mr-2" />
              Export Relationships
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => exportRelationships('json')}>
              <FileJson className="h-4 w-4 mr-2" />
              JSON Format
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportRelationships('csv')}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              CSV Format
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Download className="h-4 w-4 mr-2" />
              Export Emails
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => exportEmails('json')}>
              <FileJson className="h-4 w-4 mr-2" />
              JSON Format
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportEmails('csv')}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              CSV Format
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant="secondary" 
          size="sm" 
          className="w-full justify-start"
          onClick={exportSummary}
        >
          <FileJson className="h-4 w-4 mr-2" />
          Export Summary Report
        </Button>
      </div>
    </Card>
  );
}
