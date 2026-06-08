import { useState } from 'react';

/**
 * LoadingButton - A button that shows loading state during async operations
 * 
 * Usage:
 * <LoadingButton onClick={asyncFunction} className={styles.btn}>
 *   Click Me
 * </LoadingButton>
 */
export function LoadingButton({ 
  onClick, 
  children, 
  disabled = false, 
  className = '', 
  style = {},
  loadingText = 'Loading...',
  type = 'button',
  ...props 
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e) => {
    if (!onClick || isLoading) return;
    
    setIsLoading(true);
    try {
      await onClick(e);
    } catch (error) {
      console.error('LoadingButton error:', error);
      throw error; // Re-throw so parent can handle
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={className}
      style={{
        ...style,
        opacity: isLoading ? 0.7 : 1,
        cursor: isLoading ? 'wait' : disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
      }}
      {...props}
    >
      {isLoading ? (
        <>
          <span style={{ opacity: 0.7 }}>{loadingText}</span>
          <span
            style={{
              marginLeft: '8px',
              display: 'inline-block',
              width: '14px',
              height: '14px',
              border: '2px solid currentColor',
              borderRightColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
              verticalAlign: 'middle',
            }}
          />
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * LoadingLink - A link/button styled element that shows loading during async operations
 */
export function LoadingLink({ 
  onClick, 
  children, 
  disabled = false, 
  className = '', 
  style = {},
  loadingText = 'Loading...',
  ...props 
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    if (!onClick || isLoading) return;
    
    setIsLoading(true);
    try {
      await onClick(e);
    } catch (error) {
      console.error('LoadingLink error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={className}
      style={{
        ...style,
        opacity: isLoading ? 0.6 : 1,
        cursor: isLoading ? 'wait' : disabled ? 'not-allowed' : 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        font: 'inherit',
        color: 'inherit',
        textDecoration: 'inherit',
      }}
      {...props}
    >
      {isLoading ? (
        <>
          <span style={{ opacity: 0.7 }}>{loadingText}</span>
          <span
            style={{
              marginLeft: '6px',
              display: 'inline-block',
              width: '12px',
              height: '12px',
              border: '2px solid currentColor',
              borderRightColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
              verticalAlign: 'middle',
            }}
          />
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * useAsyncAction - Hook for handling async actions with loading state
 * 
 * Usage:
 * const { execute, isLoading } = useAsyncAction(asyncFunction);
 * <button onClick={execute} disabled={isLoading}>
 *   {isLoading ? 'Loading...' : 'Click Me'}
 * </button>
 */
export function useAsyncAction(asyncFn) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = async (...args) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await asyncFn(...args);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setIsLoading(false);
    setError(null);
  };

  return { execute, isLoading, error, reset };
}
