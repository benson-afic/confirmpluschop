import React, { useEffect, useState } from 'react';

const App = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if Telegram WebApp is available and ready
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
    } else {
      console.warn("Telegram WebApp is not available on window object.");
    }
  }, []);

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let initData = "";
      if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
         initData = window.Telegram.WebApp.initData;
      }
      
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initData }),
      });

      if (!response.ok) {
        throw new Error('Verification failed. Please try again.');
      }

      setIsSuccess(true);
      
      // Delay closing slightly so user can see success message
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
          window.Telegram.WebApp.close();
        }
      }, 1500);

    } catch (err) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden transition-all duration-300 transform">
        <div className="p-8 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-2 shadow-inner">
            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Security Check</h1>
          
          {isSuccess ? (
            <div className="py-6 space-y-3 animate-pulse">
              <div className="text-green-500 flex justify-center">
                <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-800 font-semibold text-lg">Verified!</p>
              <p className="text-gray-500 text-sm">You may return to the chat.</p>
            </div>
          ) : (
            <>
              <p className="text-gray-500 text-sm px-2">
                Please confirm that you are human to continue and access the mini app.
              </p>
              
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className={`w-full py-4 px-6 rounded-2xl text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform active:scale-95 flex justify-center items-center ${
                  isLoading 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Verifying...</span>
                  </div>
                ) : (
                  'Confirm Plus Chop! 🛑'
                )}
              </button>
              {error && <p className="text-red-500 text-sm font-medium mt-4">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
