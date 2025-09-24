import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LiveActivityTable, { Activity, ActivityType } from '../live-activity-table';

// Mock the UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  ),
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  MapPin: () => <div data-testid="map-pin-icon" />,
  LogIn: () => <div data-testid="log-in-icon" />,
  LogOut: () => <div data-testid="log-out-icon" />,
  Briefcase: () => <div data-testid="briefcase-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
}));

describe('LiveActivityTable', () => {
  const mockActivities: Activity[] = [
    {
      type: 'GPS_UPDATE' as ActivityType,
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      userId: 'user1',
      userName: 'John Doe',
      message: 'Location updated',
      meta: { lat: 12.9716, lng: 77.5946 },
    },
    {
      type: 'SESSION_CHECKIN' as ActivityType,
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
      userId: 'user2',
      userName: 'Jane Smith',
      message: 'Checked in for session',
    },
    {
      type: 'TASK_COMPLETED' as ActivityType,
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
      userId: 'user1',
      userName: 'John Doe',
      message: 'Completed task: Visit client',
    },
  ];

  const defaultProps = {
    activities: mockActivities,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders activities correctly', () => {
      render(<LiveActivityTable {...defaultProps} />);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Location updated')).toBeInTheDocument();
      expect(screen.getByText('Checked in for session')).toBeInTheDocument();
      expect(screen.getByText('Completed task: Visit client')).toBeInTheDocument();
    });

    it('renders correct icons for different activity types', () => {
      render(<LiveActivityTable {...defaultProps} />);
      
      expect(screen.getByTestId('map-pin-icon')).toBeInTheDocument();
      expect(screen.getByTestId('log-in-icon')).toBeInTheDocument();
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });

    it('renders activity badges with correct text', () => {
      render(<LiveActivityTable {...defaultProps} />);
      
      expect(screen.getByText('gps update')).toBeInTheDocument();
      expect(screen.getByText('session checkin')).toBeInTheDocument();
      expect(screen.getByText('task completed')).toBeInTheDocument();
    });

    it('renders GPS coordinates when available', () => {
      render(<LiveActivityTable {...defaultProps} />);
      
      expect(screen.getByText('📍 12.9716, 77.5946')).toBeInTheDocument();
    });

    it('shows empty state when no activities', () => {
      render(<LiveActivityTable activities={[]} />);
      
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
      expect(screen.getByTestId('map-pin-icon')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('filters activities by followedUserId', () => {
      render(<LiveActivityTable {...defaultProps} followedUserId="user1" />);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });

    it('shows all activities when followedUserId is null', () => {
      render(<LiveActivityTable {...defaultProps} followedUserId={null} />);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('shows helpful message when filtering results in no activities', () => {
      render(<LiveActivityTable {...defaultProps} followedUserId="nonexistent" />);
      
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
      expect(screen.getByText('Try selecting "All MRs" to see more activity')).toBeInTheDocument();
    });
  });

  describe('Limiting', () => {
    it('limits activities to maxItems', () => {
      const manyActivities = Array.from({ length: 10 }, (_, i) => ({
        ...mockActivities[0],
        id: `activity-${i}`,
        timestamp: new Date(Date.now() - i * 60 * 1000).toISOString(),
      }));

      render(<LiveActivityTable activities={manyActivities} maxItems={3} />);
      
      const activityElements = screen.getAllByText('John Doe');
      expect(activityElements).toHaveLength(3);
    });

    it('shows limit message when activities exceed maxItems', () => {
      const manyActivities = Array.from({ length: 10 }, (_, i) => ({
        ...mockActivities[0],
        id: `activity-${i}`,
        timestamp: new Date(Date.now() - i * 60 * 1000).toISOString(),
      }));

      render(<LiveActivityTable activities={manyActivities} maxItems={5} />);
      
      expect(screen.getByText('Showing latest 5 activities')).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('formats recent timestamps correctly', () => {
      const recentActivity = [{
        ...mockActivities[0],
        timestamp: new Date(Date.now() - 30 * 1000).toISOString(), // 30 seconds ago
      }];

      render(<LiveActivityTable activities={recentActivity} />);
      
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('formats minutes correctly', () => {
      const minuteActivity = [{
        ...mockActivities[0],
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      }];

      render(<LiveActivityTable activities={minuteActivity} />);
      
      expect(screen.getByText('5m ago')).toBeInTheDocument();
    });

    it('formats hours correctly', () => {
      const hourActivity = [{
        ...mockActivities[0],
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      }];

      render(<LiveActivityTable activities={hourActivity} />);
      
      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });
  });

  describe('User Interaction', () => {
    it('calls onUserClick when activity is clicked', () => {
      const mockOnUserClick = jest.fn();
      render(<LiveActivityTable {...defaultProps} onUserClick={mockOnUserClick} />);
      
      const activityElement = screen.getByText('John Doe').closest('div');
      fireEvent.click(activityElement!);
      
      expect(mockOnUserClick).toHaveBeenCalledWith('user1');
    });

    it('calls onUserClick when username is clicked', () => {
      const mockOnUserClick = jest.fn();
      render(<LiveActivityTable {...defaultProps} onUserClick={mockOnUserClick} />);
      
      const usernameButton = screen.getByText('John Doe');
      fireEvent.click(usernameButton);
      
      expect(mockOnUserClick).toHaveBeenCalledWith('user1');
    });

    it('does not call onUserClick when not provided', () => {
      render(<LiveActivityTable {...defaultProps} />);
      
      const activityElement = screen.getByText('John Doe').closest('div');
      expect(() => fireEvent.click(activityElement!)).not.toThrow();
    });
  });

  describe('Animation and New Activity Highlighting', () => {
    it('highlights new activities when they are added', async () => {
      const { rerender } = render(<LiveActivityTable activities={[mockActivities[0]]} />);
      
      // Add a new activity
      const newActivity = {
        ...mockActivities[1],
        timestamp: new Date().toISOString(), // Very recent
      };
      
      rerender(<LiveActivityTable activities={[mockActivities[0], newActivity]} />);
      
      // Check for animation indicator (ping animation)
      const pingElements = document.querySelectorAll('.animate-ping');
      expect(pingElements.length).toBeGreaterThan(0);
    });

    it('removes highlight after timeout', async () => {
      const { rerender } = render(<LiveActivityTable activities={[mockActivities[0]]} />);
      
      // Add a new activity
      const newActivity = {
        ...mockActivities[1],
        timestamp: new Date().toISOString(),
      };
      
      rerender(<LiveActivityTable activities={[mockActivities[0], newActivity]} />);
      
      // Fast-forward time
      jest.advanceTimersByTime(2000);
      
      await waitFor(() => {
        const pingElements = document.querySelectorAll('.animate-ping');
        expect(pingElements).toHaveLength(0);
      });
    });
  });

  describe('Performance and Infinite Loop Prevention', () => {
    it('does not cause infinite re-renders when activities change', () => {
      const { rerender } = render(<LiveActivityTable activities={mockActivities} />);
      
      // This should not cause an infinite loop
      const updatedActivities = [...mockActivities, {
        ...mockActivities[0],
        id: 'new-activity',
        timestamp: new Date().toISOString(),
      }];
      
      expect(() => {
        rerender(<LiveActivityTable activities={updatedActivities} />);
      }).not.toThrow();
    });

    it('memoizes filtered activities correctly', () => {
      const { rerender } = render(<LiveActivityTable activities={mockActivities} followedUserId="user1" />);
      
      // Re-render with same props should not cause issues
      expect(() => {
        rerender(<LiveActivityTable activities={mockActivities} followedUserId="user1" />);
      }).not.toThrow();
    });

    it('handles rapid activity updates without infinite loops', () => {
      const { rerender } = render(<LiveActivityTable activities={mockActivities} />);
      
      // Simulate rapid updates
      for (let i = 0; i < 5; i++) {
        const newActivities = [...mockActivities, {
          ...mockActivities[0],
          id: `activity-${i}`,
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
        }];
        
        expect(() => {
          rerender(<LiveActivityTable activities={newActivities} />);
        }).not.toThrow();
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles activities without IDs', () => {
      const activitiesWithoutIds = mockActivities.map(activity => ({
        ...activity,
        id: undefined,
      }));

      render(<LiveActivityTable activities={activitiesWithoutIds} />);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('handles activities with business entry meta', () => {
      const businessActivity = [{
        ...mockActivities[0],
        type: 'BUSINESS_ENTRY' as ActivityType,
        message: 'Business entry recorded',
        meta: { amount: 1500.50 },
      }];

      render(<LiveActivityTable activities={businessActivity} />);
      
      expect(screen.getByText('₹1500.50')).toBeInTheDocument();
    });

    it('handles malformed GPS coordinates gracefully', () => {
      const malformedGpsActivity = [{
        ...mockActivities[0],
        meta: { lat: 'invalid', lng: 'invalid' },
      }];

      render(<LiveActivityTable activities={malformedGpsActivity} />);
      
      // Should not crash and should not show coordinates
      expect(screen.queryByText(/📍/)).not.toBeInTheDocument();
    });
  });
});
