"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, LogIn, LogOut, Briefcase, Plus, CheckCircle } from "lucide-react";

export type ActivityType = 
  | "GPS_UPDATE"
  | "SESSION_CHECKIN"
  | "SESSION_CHECKOUT"
  | "BUSINESS_ENTRY"
  | "TASK_CREATED"
  | "TASK_COMPLETED";

export type Activity = {
  type: ActivityType;
  timestamp: string;
  userId: string;
  userName: string;
  message: string;
  meta?: Record<string, unknown>;
  id?: string; // for animation tracking
};

const getActivityIcon = (type: ActivityType) => {
  switch (type) {
    case "GPS_UPDATE":
      return <MapPin className="w-4 h-4 text-muted-foreground" />;
    case "SESSION_CHECKIN":
      return <LogIn className="w-4 h-4 text-green-600" />;
    case "SESSION_CHECKOUT":
      return <LogOut className="w-4 h-4 text-destructive" />;
    case "BUSINESS_ENTRY":
      return <Briefcase className="w-4 h-4 text-muted-foreground" />;
    case "TASK_CREATED":
      return <Plus className="w-4 h-4 text-muted-foreground" />;
    case "TASK_COMPLETED":
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    default:
      return <MapPin className="w-4 h-4 text-muted-foreground" />;
  }
};

const getActivityColor = () => {
  return "border-l-muted";
};

export default function LiveActivityTable({
  activities,
  followedUserId,
  onUserClick,
  maxItems = 50,
  className = "",
}: {
  activities: Activity[];
  followedUserId?: string | null;
  onUserClick?: (userId: string) => void;
  maxItems?: number;
  className?: string;
}) {
  const [displayedActivities, setDisplayedActivities] = useState<Activity[]>([]);
  const [newActivityIds, setNewActivityIds] = useState<Set<string>>(new Set());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filter activities for followed user if specified
  const filteredActivities = useMemo(() => {
    return followedUserId 
      ? activities.filter(activity => activity.userId === followedUserId)
      : activities;
  }, [activities, followedUserId]);

  const limitedActivities = useMemo(() => {
    return filteredActivities.slice(0, maxItems);
  }, [filteredActivities, maxItems]);

  useEffect(() => {
    // Generate IDs for activities that don't have them
    const activitiesWithIds = limitedActivities.map((activity, index) => ({
      ...activity,
      id: activity.id || `${activity.timestamp}-${activity.userId}-${index}`,
    }));

    // Only update if the activities have actually changed
    setDisplayedActivities(prevDisplayed => {
      // Check if activities are actually different
      const prevIds = prevDisplayed.map(a => a.id).join(',');
      const newIds = activitiesWithIds.map(a => a.id).join(',');
      
      if (prevIds === newIds) {
        return prevDisplayed; // No change, return previous state
      }

      const existingIds = new Set(prevDisplayed.map(a => a.id));
      const newActivityIds = new Set<string>();

      // Find truly new activities
      activitiesWithIds.forEach(activity => {
        if (!existingIds.has(activity.id)) {
          newActivityIds.add(activity.id!);
        }
      });

      // Highlight new activities
      if (newActivityIds.size > 0) {
        setNewActivityIds(newActivityIds);
        
        // Clear existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // Remove highlight after animation
        timeoutRef.current = setTimeout(() => {
          setNewActivityIds(new Set());
        }, 2000);
      }

      return activitiesWithIds;
    });
  }, [limitedActivities]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    
    return date.toLocaleDateString();
  };

  if (displayedActivities.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
            {followedUserId && (
              <p className="text-xs mt-1">Try selecting &ldquo;All MRs&rdquo; to see more activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto">
          <div className="space-y-1">
            {displayedActivities.map((activity) => {
              const isNew = newActivityIds.has(activity.id!);
              const isFollowedUser = activity.userId === followedUserId;
              
              return (
                <div
                  key={activity.id}
                  className={`
                    flex items-start gap-3 p-3 border-l-2 cursor-pointer hover:bg-muted/50 transition-colors
                    ${getActivityColor()}
                    ${isFollowedUser ? 'bg-muted/30' : ''}
                  `}
                  onClick={() => onUserClick?.(activity.userId)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getActivityIcon(activity.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <button
                        className="font-medium text-sm text-foreground hover:text-primary truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUserClick?.(activity.userId);
                        }}
                      >
                        {activity.userName}
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {activity.type.replace('_', ' ').toLowerCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {activity.message}
                    </p>
                    
                    {activity.meta && activity.type === "GPS_UPDATE" && 
                     typeof activity.meta.lat === 'number' && typeof activity.meta.lng === 'number' && (
                      <div className="text-xs text-muted-foreground font-mono">
                        📍 {activity.meta.lat.toFixed(4)}, {activity.meta.lng.toFixed(4)}
                      </div>
                    )}
                    
                    {activity.meta && activity.type === "BUSINESS_ENTRY" && 
                     typeof activity.meta.amount === 'number' && (
                      <div className="text-xs font-semibold">
                        ₹{activity.meta.amount.toFixed(2)}
                      </div>
                    )}
                  </div>
                  
                  {isNew && (
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-primary rounded-full animate-ping"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {limitedActivities.length >= maxItems && (
          <div className="p-3 border-t text-center">
            <p className="text-xs text-muted-foreground">
              Showing latest {maxItems} activities
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}