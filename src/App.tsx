import { useState, FormEvent, useRef, useEffect } from 'react';
import { verbs } from './data/verbs';
import { evaluateAnswers } from './services/ai';
import { Check, X, Loader2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function App() {
  const [practiceList, setPracticeList] = useState(() => shuffleArray(verbs));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<Record<string, any>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSummary, setIsSummary] = useState(false);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentVerb = practiceList[currentIndex];
  const currentEvaluation = currentVerb ? evaluations[currentVerb.word] : null;

  useEffect(() => {
    if (currentVerb) {
      setDraftAnswer(answers[currentVerb.word] || '');
      setError(null);
    }
  }, [currentIndex, currentVerb, answers]);

  useEffect(() => {
    if (!currentEvaluation && !isSubmitting && !isSummary && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentEvaluation, isSubmitting, isSummary, currentIndex]);

  const handleNext = () => {
    if (!currentEvaluation) return;
    
    if (currentIndex < practiceList.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsSummary(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draftAnswer.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    
    try {
      const payload = [{
        word: currentVerb.word,
        correctDefinition: currentVerb.definition,
        userAnswer: draftAnswer.trim()
      }];
      
      const result = await evaluateAnswers(payload);
      const evalData = result.evaluations[0];
      
      setEvaluations(prev => ({ ...prev, [currentVerb.word]: evalData }));
      setAnswers(prev => ({ ...prev, [currentVerb.word]: draftAnswer.trim() }));
    } catch (err) {
      console.error(err);
      setError("Failed to evaluate answer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestart = (onlyIncorrect: boolean) => {
    let newList = verbs;
    if (onlyIncorrect) {
      newList = practiceList.filter(v => {
        const ev = evaluations[v.word];
        return !ev || !ev.isCorrect;
      });
      if (newList.length === 0) newList = verbs;
    }
    
    setPracticeList(shuffleArray(newList));
    setCurrentIndex(0);
    setAnswers({});
    setEvaluations({});
    setIsSummary(false);
    setDraftAnswer('');
  };

  if (isSummary) {
    const correctWords = practiceList.filter(v => evaluations[v.word]?.isCorrect);
    const incorrectWords = practiceList.filter(v => evaluations[v.word] && !evaluations[v.word].isCorrect);
    const unansweredWords = practiceList.filter(v => !evaluations[v.word]);
    
    const needsPracticeCount = incorrectWords.length + unansweredWords.length;

    return (
      <div className="h-screen w-screen overflow-hidden bg-gray-50 text-black font-sans flex flex-col items-center justify-center p-4 md:p-8 selection:bg-black selection:text-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col h-[85vh] max-h-175 min-h-112.5 p-6 md:p-10"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6 uppercase tracking-tight border-b-4 border-black pb-4 shrink-0">Session Summary</h2>
          
          <div className="grow grid md:grid-cols-2 gap-8 mb-8 overflow-hidden">
            <div className="flex flex-col h-full">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 shrink-0 text-green-600">
                <div className="bg-green-500 text-white p-1 rounded-full"><Check size={16}/></div>
                Correct ({correctWords.length})
              </h3>
              <ul className="space-y-2 overflow-y-auto pr-2 grow">
                {correctWords.length === 0 && <li className="text-gray-400 italic">None</li>}
                {correctWords.map(w => <li key={w.word} className="font-medium text-lg">{w.word}</li>)}
              </ul>
            </div>
            
            <div className="flex flex-col h-full">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 shrink-0 text-red-600">
                <div className="bg-red-100 text-red-800 p-1 rounded-full"><X size={16}/></div>
                Needs Practice ({needsPracticeCount})
              </h3>
              <ul className="space-y-2 overflow-y-auto pr-2 grow">
                {needsPracticeCount === 0 && <li className="text-gray-400 italic">None! Perfect score!</li>}
                {incorrectWords.map(w => <li key={w.word} className="font-medium text-lg flex justify-between"><span>{w.word}</span> <span className="text-xs text-red-500 uppercase tracking-widest self-center">Incorrect</span></li>)}
                {unansweredWords.map(w => <li key={w.word} className="font-medium text-lg text-gray-500 flex justify-between"><span>{w.word}</span> <span className="text-xs uppercase tracking-widest self-center">Skipped</span></li>)}
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 shrink-0">
            {needsPracticeCount > 0 && (
              <button 
                onClick={() => handleRestart(true)} 
                className="flex-1 bg-black text-white p-3 md:p-4 text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-900 transition-colors text-center flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                Practice Incorrect ({needsPracticeCount})
              </button>
            )}
            <button 
              onClick={() => handleRestart(false)} 
              className="flex-1 border-4 border-black bg-white text-black p-3 md:p-4 text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors text-center"
            >
              Start Fresh Session
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-50 text-black font-sans flex flex-col items-center justify-center p-4 md:p-8 selection:bg-black selection:text-white">
      <div className="w-full max-w-2xl bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col relative overflow-hidden h-[85vh] max-h-175 min-h-112.5">
        
        <div className="flex justify-between items-center p-4 md:p-6 border-b-4 border-black bg-white z-10 shrink-0">
          <button 
            onClick={handlePrev} 
            disabled={currentIndex === 0} 
            className="p-2 hover:bg-gray-100 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
            aria-label="Previous word"
          >
            <ChevronLeft size={32} strokeWidth={3} />
          </button>
          
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-center px-4 pb-2">
            {currentVerb?.word}
          </h2>
          
          <button 
            onClick={handleNext} 
            disabled={!currentEvaluation}
            className="p-2 hover:bg-gray-100 disabled:opacity-20 disabled:hover:bg-transparent transition-colors flex items-center gap-1"
            aria-label="Next word"
          >
            {currentIndex === practiceList.length - 1 && (
              <span className="text-sm font-bold uppercase tracking-widest hidden sm:inline-block">Finish</span>
            )}
            <ChevronRight size={32} strokeWidth={3} />
          </button>
        </div>

        <div className="p-6 md:p-10 grow flex flex-col bg-white z-0 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {currentEvaluation ? (
              <motion.div 
                key={`review-${currentVerb.word}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                <div className="mb-4 inline-flex shrink-0">
                  {currentEvaluation.isCorrect ? (
                    <div className="bg-green-500 text-white px-4 py-2 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                      <Check size={18} strokeWidth={3} /> Correct
                    </div>
                  ) : (
                    <div className="bg-red-100 text-red-800 px-4 py-2 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                      <X size={18} strokeWidth={3} /> Incorrect
                    </div>
                  )}
                </div>
                
                <div className="space-y-4 md:space-y-5 grow overflow-y-auto pr-2 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-1">Your Answer</span>
                    <p className="text-base md:text-lg font-medium">{currentEvaluation.userAnswer}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-1">Correct Definition</span>
                    <p className="text-base md:text-lg">{currentEvaluation.correctDefinition}</p>
                  </div>
                  {currentEvaluation.example && (
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-1">Example</span>
                      <p className="text-base md:text-lg italic text-gray-800">"{currentEvaluation.example}"</p>
                    </div>
                  )}
                  <div className="pt-4 border-t-2 border-dashed border-gray-200">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-2">AI Feedback</span>
                    <p className="text-sm md:text-base text-gray-700 leading-relaxed">{currentEvaluation.feedback}</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 shrink-0">
                  <button
                    onClick={handleNext}
                    className="w-full bg-black text-white p-4 text-lg font-bold uppercase tracking-wider hover:bg-gray-900 transition-colors"
                  >
                    {currentIndex === practiceList.length - 1 ? 'Finish Session' : 'Continue'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key={`input-${currentVerb.word}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                <form onSubmit={handleSubmit} className="flex flex-col h-full grow">
                  <div className="grow flex flex-col mb-4">
                    <label htmlFor="definition" className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3 block shrink-0">
                      Enter your definition
                    </label>
                    <textarea
                      id="definition"
                      ref={inputRef}
                      value={draftAnswer}
                      onChange={(e) => setDraftAnswer(e.target.value)}
                      placeholder="Type here..."
                      className="w-full grow p-4 md:p-6 border-4 border-black text-lg md:text-xl focus:outline-none focus:ring-4 focus:ring-black/10 resize-none placeholder:text-gray-300 transition-shadow"
                      autoComplete="off"
                    />
                  </div>

                  {error && (
                    <div className="p-4 mb-4 bg-red-50 text-red-900 border-2 border-red-900 font-medium shrink-0">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || !draftAnswer.trim()}
                    className="w-full bg-black text-white p-5 text-xl font-bold uppercase tracking-wider hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-colors shrink-0"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      'Check Answer'
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <div className="mt-6 text-sm font-bold tracking-widest text-gray-500 uppercase shrink-0">
        Word {currentIndex + 1} / {practiceList.length}
      </div>
    </div>
  );
}
