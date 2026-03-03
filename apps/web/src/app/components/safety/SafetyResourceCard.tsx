/**
 * EZRI — CONVERSATION SAFETY FLOW
 * Display safety and support resources with interaction tracking
 */

import { useState, useEffect } from 'react';
import { SafetyResource } from '@/app/types/safety';
import { Phone, MessageCircle, AlertCircle, ExternalLink, Users, Copy, Check, Share2 } from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { formatPhoneNumber } from '@/app/utils/safetyResources';
import { trackResourceInteraction } from '@/app/utils/resourceTracking';
import { motion } from 'motion/react';

interface SafetyResourceCardProps {
  resource: SafetyResource;
  priority?: boolean; // Highlight as priority resource
  sessionId?: string;
  safetyState?: string;
}

export function SafetyResourceCard({ resource, priority = false, sessionId, safetyState }: SafetyResourceCardProps) {
  const [copied, setCopied] = useState(false);

  // Track view on mount
  useEffect(() => {
    trackResourceInteraction(
      resource.id,
      resource.name,
      resource.type,
      'view',
      sessionId,
      safetyState
    );
  }, [resource.id, resource.name, resource.type, sessionId, safetyState]);

  const handleCall = () => {
    trackResourceInteraction(
      resource.id,
      resource.name,
      resource.type,
      'call',
      sessionId,
      safetyState
    );
    window.location.href = `tel:${resource.phone}`;
  };

  const handleText = () => {
    trackResourceInteraction(
      resource.id,
      resource.name,
      resource.type,
      'text',
      sessionId,
      safetyState
    );
    window.location.href = `sms:${resource.phone}`;
  };

  const handleVisit = () => {
    trackResourceInteraction(
      resource.id,
      resource.name,
      resource.type,
      'visit',
      sessionId,
      safetyState
    );
    window.open(resource.url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resource.phone || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    trackResourceInteraction(
      resource.id,
      resource.name,
      resource.type,
      'share',
      sessionId,
      safetyState
    );

    const shareData = {
      title: resource.name,
      text: `${resource.name}\n${resource.description}\nPhone: ${resource.phone}\nAvailable: ${resource.availability}`,
      url: resource.url
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(
          `${shareData.title}\n\n${shareData.text}\n\n${shareData.url || ''}`
        );
        alert('Resource details copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const iconMap = {
    crisis_line: <Phone className="size-5" />,
    text_line: <MessageCircle className="size-5" />,
    emergency: <AlertCircle className="size-5" />,
    support_group: <Users className="size-5" />,
    trusted_contact: <Phone className="size-5" />,
  };

  const colorMap = {
    crisis_line: 'border-blue-200 bg-blue-50',
    text_line: 'border-purple-200 bg-purple-50',
    emergency: 'border-red-200 bg-red-50',
    support_group: 'border-green-200 bg-green-50',
    trusted_contact: 'border-orange-200 bg-orange-50',
  };

  const iconBgMap = {
    crisis_line: 'bg-blue-500',
    text_line: 'bg-purple-500',
    emergency: 'bg-red-600',
    support_group: 'bg-green-500',
    trusted_contact: 'bg-orange-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`p-5 ${priority ? 'ring-2 ring-blue-500 shadow-lg' : 'shadow-md'} ${colorMap[resource.type]} transition-all hover:shadow-xl`}>
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`p-3 rounded-xl ${iconBgMap[resource.type]} text-white flex-shrink-0`}>
            {iconMap[resource.type]}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{resource.name}</h3>
                {resource.region && (
                  <span className="text-xs font-medium text-gray-500 uppercase">{resource.region}</span>
                )}
              </div>
              {priority && (
                <span className="px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-full flex-shrink-0">
                  Priority
                </span>
              )}
            </div>

            <p className="text-sm text-gray-700 mb-4 leading-relaxed">{resource.description}</p>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              {/* Call Button */}
              {resource.phone && resource.type !== 'text_line' && (
                <Button
                  size="sm"
                  variant={resource.type === 'emergency' ? 'default' : 'outline'}
                  onClick={handleCall}
                  className={`${
                    resource.type === 'emergency' 
                      ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' 
                      : 'border-2'
                  }`}
                >
                  <Phone className="size-4 mr-2" />
                  Call {formatPhoneNumber(resource.phone)}
                </Button>
              )}

              {/* Text Button (for text lines) */}
              {resource.phone && resource.type === 'text_line' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleText}
                  className="border-2"
                >
                  <MessageCircle className="size-4 mr-2" />
                  Text {resource.phone}
                </Button>
              )}

              {/* Copy Number */}
              {resource.phone && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  className="border border-gray-300"
                >
                  {copied ? (
                    <>
                      <Check className="size-4 mr-2 text-green-600" />
                      <span className="text-green-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Secondary Actions */}
            <div className="flex flex-wrap gap-2">
              {/* Visit Website */}
              {resource.url && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleVisit}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                >
                  <ExternalLink className="size-4 mr-2" />
                  Visit Website
                </Button>
              )}

              {/* Share */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleShare}
                className="text-gray-600 hover:text-gray-700 hover:bg-gray-100"
              >
                <Share2 className="size-4 mr-2" />
                Share
              </Button>
            </div>
            
            {/* Availability */}
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
              <div className={`w-2 h-2 rounded-full ${
                resource.availability.includes('24/7') ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <span className="font-medium">Available: {resource.availability}</span>
            </div>
          </div>
        </div>

        {/* Emergency Priority Banner */}
        {resource.type === 'emergency' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 pt-4 border-t border-red-300"
          >
            <div className="flex items-center gap-2 text-sm text-red-800 font-medium">
              <AlertCircle className="size-4" />
              <span>Call immediately if there's a risk of imminent harm</span>
            </div>
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}