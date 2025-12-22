import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, X, Filter, Users } from 'lucide-react';
import { format } from 'date-fns';
import type { FilterState, Person } from '@/types/graph';
import { getCommunityColor } from '@/lib/api/graph';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  persons: Person[];
  communities: (number | null)[];
  dateRange: [Date | null, Date | null];
}

export function FilterPanel({
  filters,
  onFiltersChange,
  persons,
  communities,
  dateRange,
}: FilterPanelProps) {
  const [personSearch, setPersonSearch] = useState('');

  const filteredPersons = persons
    .filter(p => 
      p.name?.toLowerCase().includes(personSearch.toLowerCase()) ||
      p.email.toLowerCase().includes(personSearch.toLowerCase())
    )
    .slice(0, 10);

  const handleDateChange = (date: Date | undefined, isStart: boolean) => {
    onFiltersChange({
      ...filters,
      dateRange: isStart 
        ? [date || null, filters.dateRange[1]]
        : [filters.dateRange[0], date || null],
    });
  };

  const handleCommunityToggle = (communityId: number) => {
    const newCommunities = filters.selectedCommunities.includes(communityId)
      ? filters.selectedCommunities.filter(c => c !== communityId)
      : [...filters.selectedCommunities, communityId];
    
    onFiltersChange({
      ...filters,
      selectedCommunities: newCommunities,
    });
  };

  const resetFilters = () => {
    onFiltersChange({
      dateRange: [null, null],
      minEmails: 1,
      sentimentRange: [-1, 1],
      selectedPerson: null,
      selectedCommunities: [],
      showNegativeOnly: false,
    });
    setPersonSearch('');
  };

  return (
    <div className="space-y-6 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </h3>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Date Range</Label>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal flex-1",
                  !filters.dateRange[0] && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {filters.dateRange[0] ? format(filters.dateRange[0], "MMM d, yyyy") : "Start"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateRange[0] || undefined}
                onSelect={(date) => handleDateChange(date, true)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal flex-1",
                  !filters.dateRange[1] && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {filters.dateRange[1] ? format(filters.dateRange[1], "MMM d, yyyy") : "End"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateRange[1] || undefined}
                onSelect={(date) => handleDateChange(date, false)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Person Search */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Search Person</Label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={personSearch}
            onChange={(e) => setPersonSearch(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>
        {personSearch && filteredPersons.length > 0 && (
          <div className="bg-popover border border-border rounded-md max-h-40 overflow-auto">
            {filteredPersons.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  onFiltersChange({ ...filters, selectedPerson: p.id });
                  setPersonSearch('');
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
              >
                <div className="font-medium">{p.name || p.email.split('@')[0]}</div>
                <div className="text-xs text-muted-foreground">{p.email}</div>
              </button>
            ))}
          </div>
        )}
        {filters.selectedPerson && (
          <div className="flex items-center gap-2 bg-accent/50 rounded-md px-2 py-1">
            <span className="text-sm flex-1">
              {persons.find(p => p.id === filters.selectedPerson)?.name || 'Selected'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onFiltersChange({ ...filters, selectedPerson: null })}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Min Emails */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-xs text-muted-foreground">Min Emails</Label>
          <span className="text-xs font-medium">{filters.minEmails}</span>
        </div>
        <Slider
          value={[filters.minEmails]}
          onValueChange={([value]) => onFiltersChange({ ...filters, minEmails: value })}
          min={1}
          max={50}
          step={1}
        />
      </div>

      {/* Sentiment Range */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-xs text-muted-foreground">Sentiment Range</Label>
          <span className="text-xs font-medium">
            {filters.sentimentRange[0].toFixed(1)} to {filters.sentimentRange[1].toFixed(1)}
          </span>
        </div>
        <Slider
          value={filters.sentimentRange}
          onValueChange={(value) => 
            onFiltersChange({ ...filters, sentimentRange: value as [number, number] })
          }
          min={-1}
          max={1}
          step={0.1}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Negative</span>
          <span>Neutral</span>
          <span>Positive</span>
        </div>
      </div>

      {/* Show Negative Only */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="negative-only"
          checked={filters.showNegativeOnly}
          onCheckedChange={(checked) => 
            onFiltersChange({ ...filters, showNegativeOnly: checked as boolean })
          }
        />
        <Label htmlFor="negative-only" className="text-sm cursor-pointer">
          Show negative relationships only
        </Label>
      </div>

      {/* Communities */}
      {communities.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            Communities
          </Label>
          <div className="flex flex-wrap gap-1">
            {communities.filter(c => c !== null).map(communityId => (
              <button
                key={communityId}
                onClick={() => handleCommunityToggle(communityId!)}
                className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium transition-all",
                  filters.selectedCommunities.includes(communityId!)
                    ? "ring-2 ring-primary ring-offset-1"
                    : "opacity-70 hover:opacity-100"
                )}
                style={{ 
                  backgroundColor: getCommunityColor(communityId),
                  color: 'white',
                }}
              >
                #{communityId}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
