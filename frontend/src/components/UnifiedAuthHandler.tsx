/**
 * Unified Authentication Handler
 * Handles authentication for all platforms (Telegram, VK, Web) using a single workflow
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { detectPlatform, getPlatformAuthData, authWithPlatform, type Platform } from '../utils/platform'
import { storageSync } from '../utils/storage'
import { api } from '../services/api'
import { logger } from '../utils/logger'

export function UnifiedAuthHandler() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isChecking, setIsChecking] = useState(true)
  const hasAttemptedAuth = useRef(false)

  useEffect(() => {
    let mounted = true
    let timeoutId: ReturnType<typeof setTimeout>

    const performAuth = async () => {
      logger.log('[UnifiedAuthHandler] Starting unified auth check...', {
        pathname: location.pathname,
        url: window.location.href,
        timestamp: new Date().toISOString()
      })

      try {
        // Timeout after 10 seconds
        timeoutId = setTimeout(() => {
          if (mounted) {
            logger.warn('[UnifiedAuthHandler] Auth check timeout after 10 seconds')
            setIsChecking(false)
          }
        }, 10000)

        // Step 1: Detect platform
        const platform = detectPlatform()
        logger.log('[UnifiedAuthHandler] Detected platform:', platform)

        // Step 2: If web platform, skip auto-auth
        if (platform === 'web') {
          console.log('[UnifiedAuthHandler] Web platform detected, skipping auto-auth')
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
          }
          return
        }

        // Step 3: Check if we already have a valid token
        const existingToken = storageSync.getItem('token')
        if (existingToken) {
          try {
            const user = await api.getCurrentUser()
            if (user && mounted) {
              console.log('[UnifiedAuthHandler] Valid token exists, user authenticated')
              clearTimeout(timeoutId)
              setIsChecking(false)
              
              // If on login/register page, redirect to home
              if (location.pathname === '/login' || location.pathname === '/register') {
                const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/'
                navigate(returnTo)
              }
              return
            }
          } catch (error) {
            // Token invalid, continue with auth
            logger.log('[UnifiedAuthHandler] Existing token invalid, will re-authenticate')
            storageSync.removeItem('token')
            api.setToken(null)
          }
        }

        // Step 4: Prevent duplicate auth attempts
        if (hasAttemptedAuth.current) {
          logger.log('[UnifiedAuthHandler] Auth already attempted, skipping')
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
          }
          return
        }

        // Step 5: Get platform-specific auth data
        logger.log('[UnifiedAuthHandler] Getting auth data for platform:', platform)
        const authData = await getPlatformAuthData(platform, 8000)
        
        if (!authData || authData.length === 0) {
          logger.warn('[UnifiedAuthHandler] No auth data available for platform:', platform)
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
            
            // Only redirect to login if not already there
            if (location.pathname !== '/login' && location.pathname !== '/register') {
              navigate('/login')
            }
          }
          return
        }

        // Step 6: Perform authentication
        logger.log('[UnifiedAuthHandler] Attempting authentication for platform:', platform)
        hasAttemptedAuth.current = true
        
        try {
          const response = await authWithPlatform(platform, authData, existingToken)
          
          logger.log('[UnifiedAuthHandler] Authentication successful:', {
            platform,
            userId: response.user?.id,
            hasAccessToken: !!response.access_token
          })
          
          if (mounted) {
            // Verify token was saved
            let savedToken: string | null = storageSync.getItem('token')
            
            // If not found synchronously, try async (for VK Storage)
            if (!savedToken || savedToken !== response.access_token) {
              try {
                const { default: storage } = await import('../utils/storage')
                savedToken = await Promise.race([
                  storage.getItem('token'),
                  new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 500))
                ])
              } catch (error) {
                logger.warn('[UnifiedAuthHandler] Token verification failed:', error)
              }
            }
            
            // Mark that user just logged in
            sessionStorage.setItem('justLoggedIn', 'true')
            
            // Track event
            try {
              await api.trackEvent('miniapp_open', `${platform}_miniapp_launch`, {
                path: location.pathname,
                hasToken: !!savedToken
              })
            } catch (error) {
              // Ignore analytics errors
            }
            
            clearTimeout(timeoutId)
            setIsChecking(false)
            
            // Redirect to home or returnTo
            if (location.pathname === '/login' || location.pathname === '/register') {
              const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/'
              navigate(returnTo, { replace: true })
            }
          }
        } catch (error: any) {
          logger.error('[UnifiedAuthHandler] Authentication failed:', error)
          
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
            
            // Only redirect to login if not already there
            if (location.pathname !== '/login' && location.pathname !== '/register') {
              navigate('/login')
            }
          }
        }
      } catch (error) {
        logger.error('[UnifiedAuthHandler] Auth check error:', error)
        if (mounted) {
          clearTimeout(timeoutId)
          setIsChecking(false)
        }
      }
    }

    performAuth()

    return () => {
      mounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [navigate, location.pathname])

  // Show loading spinner only on login/register pages
  if (isChecking && (location.pathname === '/login' || location.pathname === '/register')) {
    return <LoadingSpinner />
  }

  return null
}

// Simple loading spinner component
function LoadingSpinner() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      zIndex: 9999
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #3498db',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

