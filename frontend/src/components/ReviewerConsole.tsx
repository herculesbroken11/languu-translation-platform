'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ReviewTask {
  segmentId: string;
  sessionId: string;
  originalText: string;
  translatedText: string;
  classification?: string;
  confidence?: number;
  status: string;
  createdAt: string;
}

const ReviewerConsole: React.FC = () => {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(null);
  const [approvedText, setApprovedText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.languu.com';

  useEffect(() => {
    loadPendingReviews();
    // Poll for new reviews every 5 seconds
    const interval = setInterval(loadPendingReviews, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPendingReviews = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/hitl/pending`);
      if (response.data.success && response.data.data) {
        setTasks(response.data.data.reviews || []);
      }
    } catch (err) {
      console.error('Failed to load pending reviews:', err);
    }
  };

  const handleSelectTask = (task: ReviewTask) => {
    setSelectedTask(task);
    setApprovedText(task.translatedText);
    setFeedback('');
  };

  const handleSubmitReview = async () => {
    if (!selectedTask || !approvedText.trim()) {
      setError('Please provide approved text');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${apiBaseUrl}/hitl/submit`, {
        segmentId: selectedTask.segmentId,
        approvedText: approvedText.trim(),
        reviewerId: 'reviewer-1', // In production, get from auth
        feedback: feedback.trim(),
      });

      if (response.data.success) {
        // Remove task from list
        setTasks((prev) => prev.filter((t) => t.segmentId !== selectedTask.segmentId));
        setSelectedTask(null);
        setApprovedText('');
        setFeedback('');
        await loadPendingReviews();
      } else {
        setError('Failed to submit review');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Reviews List */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4">Pending Reviews</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {tasks.length === 0 ? (
              <p className="text-gray-500 text-sm">No pending reviews</p>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.segmentId}
                  onClick={() => handleSelectTask(task)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedTask?.segmentId === task.segmentId
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-500">#{task.segmentId.slice(-8)}</span>
                    {task.confidence !== undefined && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                        {Math.round(task.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{task.originalText}</p>
                  {task.classification && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded mt-2 inline-block">
                      {task.classification}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Review Interface */}
        <div className="lg:col-span-2">
          {selectedTask ? (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Review Translation</h2>

              {/* Original Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Original Text
                </label>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-gray-900">{selectedTask.originalText}</p>
                </div>
              </div>

              {/* Machine Translation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Machine Translation
                </label>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-gray-900">{selectedTask.translatedText}</p>
                </div>
              </div>

              {/* Approved Translation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Approved Translation *
                </label>
                <textarea
                  value={approvedText}
                  onChange={(e) => setApprovedText(e.target.value)}
                  placeholder="Edit the translation if needed..."
                  className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>

              {/* Feedback */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Feedback (Optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Add any feedback or notes..."
                  className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={handleSubmitReview}
                  disabled={isLoading || !approvedText.trim()}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isLoading ? 'Submitting...' : 'Approve & Submit'}
                </button>
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    setApprovedText('');
                    setFeedback('');
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500">Select a review task to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewerConsole;
