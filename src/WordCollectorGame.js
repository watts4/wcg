import React, { useState, useEffect, useRef } from 'react';
import words from 'an-array-of-english-words';
import './WordCollectorGame.css';

const WordCollectorGame = () => {
  // Game states
  const [score, setScore] = useState(100);
  const [highScores, setHighScores] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [currentWord, setCurrentWord] = useState([]);
  const [fallingElements, setFallingElements] = useState([]);
  const [wordIsValid, setWordIsValid] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState(1);
  const [lastClick, setLastClick] = useState({ id: null, time: 0 });
  const [fallSpeedMultiplier, setFallSpeedMultiplier] = useState(1.0);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  // Add state for tracking game time - simplified
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Dragging states
  const [isDragging, setIsDragging] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const gameAreaRef = useRef(null);
  const gameLoopRef = useRef(null);
  const generationLoopRef = useRef(null);
  const requestRef = useRef(null);
  const timerRef = useRef(null);
  
  // Word validation function - requiring at least 3 letters
  const isValidWord = (word) => {
    const lowerWord = word.toLowerCase();
    return lowerWord.length >= 3 && words.includes(lowerWord);
  };
  
  // Word parts and their point values - only single letters with weighted distribution
  const wordParts = [
    // Letters with frequencies based on English language usage
    { part: 'e', value: 1 }, { part: 'e', value: 1 }, { part: 'e', value: 1 }, // Most common
    { part: 't', value: 1 }, { part: 't', value: 1 },
    { part: 'a', value: 1 }, { part: 'a', value: 1 },
    { part: 'o', value: 1 }, { part: 'o', value: 1 },
    { part: 'i', value: 1 }, { part: 'i', value: 1 },
    { part: 'n', value: 1 }, { part: 'n', value: 1 },
    { part: 's', value: 1 }, { part: 's', value: 1 },
    { part: 'r', value: 1 }, { part: 'r', value: 1 },
    { part: 'h', value: 2 }, { part: 'h', value: 2 },
    { part: 'd', value: 2 }, { part: 'd', value: 2 },
    { part: 'l', value: 2 }, { part: 'l', value: 2 },
    { part: 'u', value: 2 }, { part: 'u', value: 2 },
    { part: 'c', value: 3 }, { part: 'c', value: 3 },
    { part: 'm', value: 3 }, { part: 'm', value: 3 },
    { part: 'f', value: 4 }, { part: 'f', value: 4 },
    { part: 'w', value: 4 }, { part: 'w', value: 4 },
    { part: 'g', value: 4 },
    { part: 'y', value: 4 },
    { part: 'p', value: 4 },
    { part: 'b', value: 5 },
    { part: 'v', value: 6 },
    { part: 'k', value: 7 },
    { part: 'j', value: 8 },
    { part: 'x', value: 8 },
    { part: 'q', value: 10 },
    { part: 'z', value: 10 }
  ];

  // Format seconds into a readable time string (e.g., "2m 45s")
  const formatTime = (seconds) => {
    // Ensure we have a valid number and round to nearest integer
    const totalSeconds = Math.round(seconds || 0);
    
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  // Start the game
  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setShowNameInput(false);
    setScore(100);
    setCurrentWord([]);
    setFallingElements([]);
    setDifficulty(1);
    setFallSpeedMultiplier(1.0);
    
    // Initialize the timer - start from 0 and count up
    setStartTime(Date.now());
    setElapsedTime(0);
    
    // Set up timer to update elapsed time every 100ms for smoother updates
    timerRef.current = setInterval(() => {
      setElapsedTime(prevTime => {
        // Increment by 0.1 second every 100ms
        return prevTime + 0.1;
      });
    }, 100);

    // Set up game loops
    gameLoopRef.current = setInterval(() => {
      updateGameState();
    }, 50);

    generationLoopRef.current = setInterval(() => {
      generateNewElement();
    }, 1200 - difficulty * 150); // Even faster generation
  };

  // Game over function
  const endGame = () => {
    setGameOver(true);
    setGameStarted(false);
    setShowNameInput(true);
    
    // Stop all game timers
    clearInterval(gameLoopRef.current);
    clearInterval(generationLoopRef.current);
    clearInterval(timerRef.current);
    cancelAnimationFrame(requestRef.current);
    
    // The elapsed time is already tracked by our timer, no need to recalculate
    console.log("Game over - elapsed time:", elapsedTime, "formatted as:", formatTime(elapsedTime));
  };
  
  // Save high score with player name
  const saveHighScore = () => {
    const name = playerName.trim() || 'Anonymous';
    
    // Store both time and points
    const newHighScores = [...highScores, { 
      name, 
      time: elapsedTime,
      points: Math.floor(score)
    }]
      .sort((a, b) => b.time - a.time) // Sort by longest time (descending)
      .slice(0, 5);
    
    // Log for debugging
    console.log("Saving high score:", { 
      name, 
      time: elapsedTime, 
      formattedTime: formatTime(elapsedTime),
      points: Math.floor(score)
    });
    
    setHighScores(newHighScores);
    setShowNameInput(false);
    setPlayerName('');
  };

  // Generate new word parts or letters
  const generateNewElement = () => {
    if (!gameAreaRef.current || gameOver) return;
    
    const gameWidth = gameAreaRef.current.offsetWidth;
    const randomPart = wordParts[Math.floor(Math.random() * wordParts.length)];
    const xPosition = Math.random() * (gameWidth - 60);
    
    const newElement = {
      id: Date.now() + Math.random(), // Ensure unique IDs
      part: randomPart.part,
      value: randomPart.value,
      x: xPosition,
      y: 0,
      speed: (2.0 + Math.random() * difficulty * 1.0) * fallSpeedMultiplier, // Much higher base speed
      selected: false,
      width: 50,
      height: 50
    };
    
    setFallingElements(prev => [...prev, newElement]);
  };

  // Update game state (animation frame loop)
  const updateGameState = () => {
    if (gameOver) return;
    
    // Update falling elements
    setFallingElements(prev => {
      return prev.map(element => {
        // Skip position update for elements being dragged
        if (isDragging && element.id === draggedId) {
          return element;
        }
        
        // Always continue falling, even if selected
        const newY = element.y + element.speed;
        
        // Check if element hit bottom
        if (newY > (gameAreaRef.current?.offsetHeight || 600) - element.height) {
          // If it was selected, remove from current word
          if (element.selected) {
            setCurrentWord(prevWord => 
              prevWord.filter(word => word.id !== element.id)
            );
          }
          
          // Penalize player - full point value lost
          setScore(prevScore => {
            const newScore = prevScore - element.value;
            if (newScore <= 0) {
              endGame();
              return 0;
            }
            return newScore;
          });
          
          // Increase fall speed based on letter value - dramatically more aggressive
          setFallSpeedMultiplier(prev => {
            // Tripled increase rate - much faster progression
            const increase = 0.15 * element.value; 
            // Increased max speed cap to 12.0x 
            return Math.min(prev + increase, 12.0);
          });
          
          // Remove the element
          return null;
        }
        
        return { ...element, y: newY };
      }).filter(Boolean);
    });
    
    // Increase difficulty more rapidly over time
    if (gameStarted && score > 0 && Math.random() < 0.001) { // Doubled chance
      setDifficulty(prev => Math.min(prev + 0.2, 10)); // Doubled increase and higher cap
    }
    
    // Periodically adjust generation interval based on current difficulty and speed
    if (gameStarted && generationLoopRef.current && Math.random() < 0.02) { // Doubled chance
      clearInterval(generationLoopRef.current);
      generationLoopRef.current = setInterval(() => {
        generateNewElement();
      }, Math.max(200, 1200 - (difficulty * 150) - (fallSpeedMultiplier * 150))); // Faster minimum and generation
    }
  };
  
  // Check if word is valid whenever currentWord changes
  useEffect(() => {
    if (currentWord.length === 0) {
      setWordIsValid(false);
      return;
    }
    
    const wordString = currentWord.map(word => word.part).join('').toLowerCase();
    const isValid = isValidWord(wordString);
    
    // If we just found a valid word
    if (isValid && !wordIsValid) {
      // Calculate points
      const wordScore = currentWord.reduce((sum, part) => sum + part.value, 0);
      const lengthBonus = currentWord.reduce((sum, part) => sum + part.part.length, 0) * 0.5;
      const totalPoints = wordScore + lengthBonus;
      
      // Award points
      setScore(prev => prev + totalPoints);
      
      // Decrease fall speed based on points earned - less impact to make game harder
      setFallSpeedMultiplier(prev => {
        // Reduced slowdown effect for challenge
        const decrease = 0.01 * totalPoints;
        // Don't go below the base speed (1.0)
        return Math.max(prev - decrease, 1.0);
      });
      
      // Get IDs to remove
      const idsToRemove = currentWord.map(item => item.id);
      
      // Remove selected elements from game
      setFallingElements(prev => 
        prev.filter(element => !idsToRemove.includes(element.id))
      );
      
      // Clear current word
      setTimeout(() => {
        setCurrentWord([]);
        setWordIsValid(false);
      }, 300); // Short delay for feedback
    } else {
      setWordIsValid(isValid);
    }
  }, [currentWord]);

  // Handle mouse/touch down for dragging
  const handleMouseDown = (elementId, event) => {
    const element = fallingElements.find(el => el.id === elementId);
    if (!element) return;
    
    // Record the initial position where the user clicked relative to the element
    const offsetX = event.clientX - element.x;
    const offsetY = event.clientY - element.y;
    setDragOffset({ x: offsetX, y: offsetY });
    
    // Start tracking this element for potential dragging
    setDraggedId(elementId);
  };

  // Handle mouse/touch move for dragging
  const handleMouseMove = (event) => {
    if (!draggedId) return;
    
    // If we move more than 5px, consider it a drag
    if (!isDragging) {
      const moveDistance = Math.abs(event.movementX) + Math.abs(event.movementY);
      if (moveDistance > 5) {
        setIsDragging(true);
      }
      return;
    }
    
    // Update the element position based on mouse/touch movement
    setFallingElements(prev => prev.map(element => {
      if (element.id === draggedId) {
        return {
          ...element,
          x: event.clientX - dragOffset.x,
          y: event.clientY - dragOffset.y
        };
      }
      return element;
    }));
  };

  // Handle mouse/touch up for dragging or clicking
  const handleMouseUp = (elementId) => {
    // If we weren't dragging, treat it as a click (select/deselect)
    if (draggedId === elementId && !isDragging) {
      handleElementClick(elementId);
    }
    
    // Reset dragging state
    setIsDragging(false);
    setDraggedId(null);
  };

  // Handle click on a falling element
  const handleElementClick = (elementId) => {
    if (gameOver) return;
    
    const now = Date.now();
    const element = fallingElements.find(el => el.id === elementId);
    
    if (!element) return;
    
    // Update last click for double click detection
    setLastClick({ id: elementId, time: now });
    
    // Toggle selection - if already selected, deselect it
    if (element.selected) {
      // Remove from current word
      setCurrentWord(prev => prev.filter(word => word.id !== elementId));
      
      // Update element to deselected state
      setFallingElements(prev => 
        prev.map(el => 
          el.id === elementId 
            ? { ...el, selected: false } 
            : el
        )
      );
    } else {
      // Not selected yet, add to current word
      setCurrentWord(prev => [...prev, { 
        id: element.id, 
        part: element.part, 
        value: element.value 
      }]);
      
      // Mark as selected
      setFallingElements(prev => 
        prev.map(el => 
          el.id === elementId 
            ? { ...el, selected: true } 
            : el
        )
      );
    }
  };

  // Reset word selection
  const resetWordSelection = () => {
    setCurrentWord([]);
    
    // Unselect all elements but keep them falling
    setFallingElements(prev => 
      prev.map(element => ({
        ...element,
        selected: false
      }))
    );
  };

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      clearInterval(gameLoopRef.current);
      clearInterval(generationLoopRef.current);
      clearInterval(timerRef.current);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Handle input change for player name
  const handleNameChange = (e) => {
    setPlayerName(e.target.value);
  };

  return (
    <div className="game-container">
      {!gameStarted && !gameOver ? (
        <div className="text-center">
          <h1 className="title">Word Collector</h1>
          <p className="description">
            Tap falling letters to create words. Drag letters to move them around.
            Don't let them hit the bottom!
          </p>
          <button 
            onClick={startGame}
            className="start-button"
          >
            Start Game
          </button>
          
          {highScores.length > 0 && (
            <div className="high-scores">
              <h2 className="high-scores-title">High Scores</h2>
              <div className="high-scores-list">
                {highScores.map((scoreEntry, index) => (
                  <div key={index} className="high-score-item">
                    <span>#{index + 1}: {scoreEntry.name}</span>
                    <span>
                      {formatTime(scoreEntry.time)} 
                      {scoreEntry.points !== undefined && ` (${scoreEntry.points} pts)`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : gameOver ? (
        <div className="text-center">
          <h1 className="title">Game Over</h1>
          <p className="score">Your Time: {formatTime(elapsedTime)}</p>
          <p className="score">Points: {Math.floor(score)}</p>
          
          {showNameInput ? (
            <div className="name-input-container">
              <p>Enter your name for the high score:</p>
              <input 
                type="text" 
                value={playerName} 
                onChange={handleNameChange}
                className="name-input"
                maxLength={15}
                placeholder="Your Name"
              />
              <button onClick={saveHighScore} className="save-score-button">
                Save Score
              </button>
            </div>
          ) : (
            <div className="high-scores">
              <h2 className="high-scores-title">High Scores</h2>
              <div className="high-scores-list">
                {highScores.map((scoreEntry, index) => (
                  <div key={index} className="high-score-item">
                    <span>#{index + 1}: {scoreEntry.name}</span>
                    <span>
                      {formatTime(scoreEntry.time)} 
                      {scoreEntry.points !== undefined && ` (${scoreEntry.points} pts)`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <button 
            onClick={startGame}
            className="start-button"
          >
            Play Again
          </button>
        </div>
      ) : (
        <div className="game-area">
          {/* Score and Time Display */}
          <div className="score-display">
            <div>
              <span className="score">Score: {Math.floor(score)}</span>
            </div>
            <div>
              <span className="timer">Time: {formatTime(elapsedTime)}</span>
            </div>
            <div>
              <span className="level">Level: {Math.floor(difficulty)} (Speed: {fallSpeedMultiplier.toFixed(2)}x)</span>
            </div>
          </div>
          
          {/* Game Area */}
          <div 
            ref={gameAreaRef} 
            className="play-area"
            onMouseMove={handleMouseMove}
            onMouseUp={() => {
              setIsDragging(false);
              setDraggedId(null);
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              handleMouseMove({ 
                clientX: touch.clientX, 
                clientY: touch.clientY,
                movementX: 10, // Force it to be considered a drag on touch
                movementY: 10
              });
            }}
            onTouchEnd={() => {
              setIsDragging(false);
              setDraggedId(null);
            }}
          >
            {/* Falling Elements */}
            {fallingElements.map(element => (
              <div
                key={element.id}
                className={`falling-element ${element.selected ? 'selected' : ''}`}
                style={{
                  left: `${element.x}px`,
                  top: `${element.y}px`,
                  width: `${element.width}px`,
                  height: `${element.height}px`,
                  cursor: isDragging && draggedId === element.id ? 'grabbing' : 'grab'
                }}
                onMouseDown={(e) => handleMouseDown(element.id, e)}
                onMouseUp={() => handleMouseUp(element.id)}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  handleMouseDown(element.id, { clientX: touch.clientX, clientY: touch.clientY });
                }}
                onTouchEnd={() => handleMouseUp(element.id)}
              >
                {element.part}
                <span className="element-value">{element.value}</span>
              </div>
            ))}
          </div>
          
          {/* Word Building Area */}
          <div className="word-building-area">
            <div className="current-word">
              {currentWord.map((part, index) => (
                <div key={index} className="word-part">
                  {part.part}
                  <span className="part-value">{part.value}</span>
                </div>
              ))}
            </div>
            
            <div className="word-controls">
              <button 
                onClick={resetWordSelection}
                className="reset-button"
              >
                Reset Word
              </button>
              
              <div className="word-status">
                {currentWord.length > 0 && (
                  <span className={wordIsValid ? 'valid-word' : 'invalid-word'}>
                    {wordIsValid 
                      ? 'Valid word! Points awarded.' 
                      : 'Keep building your word... (need at least 3 letters)'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordCollectorGame;