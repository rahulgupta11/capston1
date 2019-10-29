/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
const questions = require('./questions');
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');

const ANSWER_COUNT = 4;
const GAME_LENGTH = 3;

function populateGameQuestions(translatedQuestions) {
  const gameQuestions = [];
  const indexList = [];
  let index = translatedQuestions.length;
  if (GAME_LENGTH > index) {
    throw new Error('Invalid Game Length.');
  }

  for (let i = 0; i < translatedQuestions.length; i += 1) {
    indexList.push(i);
  }

  for (let j = 0; j < GAME_LENGTH; j += 1) {
    const rand = Math.floor(Math.random() * index);
    index -= 1;

    const temp = indexList[index];
    indexList[index] = indexList[rand];
    indexList[rand] = temp;
    gameQuestions.push(indexList[index]);
  }
  return gameQuestions;
}

function populateRoundAnswers(
  gameQuestionIndexes,
  correctAnswerIndex,
  correctAnswerTargetLocation,
  translatedQuestions
) {
  const answers = [];
  const translatedQuestion = translatedQuestions[gameQuestionIndexes[correctAnswerIndex]];
  const answersCopy = translatedQuestion[Object.keys(translatedQuestion)[0]].slice();
  let index = answersCopy.length;

  if (index < ANSWER_COUNT) {
    throw new Error('Not enough answers for question.');
  }

  // Shuffle the answers, excluding the first element which is the correct answer.
  for (let j = 1; j < answersCopy.length; j += 1) {
    const rand = Math.floor(Math.random() * (index - 1)) + 1;
    index -= 1;

    const swapTemp1 = answersCopy[index];
    answersCopy[index] = answersCopy[rand];
    answersCopy[rand] = swapTemp1;
  }

  // Swap the correct answer into the target location
  for (let i = 0; i < ANSWER_COUNT; i += 1) {
    answers[i] = answersCopy[i];
  }
  const swapTemp2 = answers[0];
  answers[0] = answers[correctAnswerTargetLocation];
  answers[correctAnswerTargetLocation] = swapTemp2;
  return answers;
}

function isAnswerSlotValid(intent) {
  const answerSlotFilled = intent
    && intent.slots
    && intent.slots.Answer
    && intent.slots.Answer.value;
  const answerSlotIsInt = answerSlotFilled
    && !Number.isNaN(parseInt(intent.slots.Answer.value, 10));
  return answerSlotIsInt
    && parseInt(intent.slots.Answer.value, 10) < (ANSWER_COUNT + 1)
    && parseInt(intent.slots.Answer.value, 10) > 0;
}

function handleUserGuess(userGaveUp, handlerInput) {
  const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
  const { intent } = requestEnvelope.request;

  const answerSlotValid = isAnswerSlotValid(intent);

  let speechOutput = '';
  let speechOutputAnalysis = '';

  const sessionAttributes = attributesManager.getSessionAttributes();
  const gameQuestions = sessionAttributes.questions;
  let correctAnswerIndex = parseInt(sessionAttributes.correctAnswerIndex, 10);
  let currentScore = parseInt(sessionAttributes.score, 10);
  let currentQuestionIndex = parseInt(sessionAttributes.currentQuestionIndex, 10);
  const { correctAnswerText } = sessionAttributes;
  const requestAttributes = attributesManager.getRequestAttributes();
  const translatedQuestions = requestAttributes.t('QUESTIONS');


  if (answerSlotValid
    && parseInt(intent.slots.Answer.value, 10) === sessionAttributes.correctAnswerIndex) {
    currentScore += 1;
    //speechOutputAnalysis = requestAttributes.t('ANSWER_CORRECT_MESSAGE');
  } else {
    if (!userGaveUp) {
      //speechOutputAnalysis = requestAttributes.t('ANSWER_WRONG_MESSAGE');
    }
/*
    speechOutputAnalysis += requestAttributes.t(
      'CORRECT_ANSWER_MESSAGE',
      correctAnswerIndex,
      correctAnswerText
    );*/
  }

  // Check if we can exit the game session after GAME_LENGTH questions (zero-indexed)
  if (sessionAttributes.currentQuestionIndex === GAME_LENGTH - 1) {
    //speechOutput = userGaveUp ? '' : requestAttributes.t('ANSWER_IS_MESSAGE');
    sessionAttributes.score = currentScore;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    speechOutput += speechOutputAnalysis + requestAttributes.t(
      'GAME_OVER_MESSAGE',
      currentScore.toString(),
      GAME_LENGTH.toString()
    );

    return responseBuilder
      .speak(speechOutput)
      .reprompt(speechOutput)
      .getResponse();
  }
  currentQuestionIndex += 1;
  correctAnswerIndex = Math.floor(Math.random() * (ANSWER_COUNT));
  const spokenQuestion = Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0];
  const roundAnswers = populateRoundAnswers(
    gameQuestions,
    currentQuestionIndex,
    correctAnswerIndex,
    translatedQuestions
  );
  const questionIndexForSpeech = currentQuestionIndex + 1;
  let repromptText = requestAttributes.t(
    'TELL_QUESTION_MESSAGE',
    questionIndexForSpeech.toString(),
    spokenQuestion
  );

  for (let i = 0; i < ANSWER_COUNT; i += 1) {
    repromptText += `${i + 1}. ${roundAnswers[i]}. `;
  }

 //speechOutput += userGaveUp ? '' : requestAttributes.t('ANSWER_IS_MESSAGE');
  speechOutput += speechOutputAnalysis
    + requestAttributes.t('Your Answer has Recorded ', currentScore.toString())
    + repromptText;

  const translatedQuestion = translatedQuestions[gameQuestions[currentQuestionIndex]];

  Object.assign(sessionAttributes, {
    speechOutput: repromptText,
    repromptText,
    currentQuestionIndex,
    correctAnswerIndex: correctAnswerIndex + 1,
    questions: gameQuestions,
    score: currentScore,
    correctAnswerText: translatedQuestion[Object.keys(translatedQuestion)[0]][0]
  });

  return responseBuilder.speak(speechOutput)
    .reprompt(repromptText)
    .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
    .getResponse();
}

function startGame(newGame, handlerInput) {
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  let speechOutput = newGame
    ? requestAttributes.t('NEW_GAME_MESSAGE', requestAttributes.t('GAME_NAME'))
      + requestAttributes.t('WELCOME_MESSAGE', GAME_LENGTH.toString())
    : '';
  const translatedQuestions = requestAttributes.t('QUESTIONS');
  const gameQuestions = populateGameQuestions(translatedQuestions);
  const correctAnswerIndex = Math.floor(Math.random() * (ANSWER_COUNT));

  const roundAnswers = populateRoundAnswers(
    gameQuestions,
    0,
    correctAnswerIndex,
    translatedQuestions
  );
  const currentQuestionIndex = 0;
  const spokenQuestion = Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0];
  let repromptText = requestAttributes.t('TELL_QUESTION_MESSAGE', '1', spokenQuestion);
  for (let i = 0; i < ANSWER_COUNT; i += 1) {
    repromptText += `${i + 1}. ${roundAnswers[i]}. `;
  }

  speechOutput += repromptText;
  const sessionAttributes = {};

  const translatedQuestion = translatedQuestions[gameQuestions[currentQuestionIndex]];

  Object.assign(sessionAttributes, {
    speechOutput: repromptText,
    repromptText,
    currentQuestionIndex,
    correctAnswerIndex: correctAnswerIndex + 1,
    questions: gameQuestions,
    score: 0,
    correctAnswerText: translatedQuestion[Object.keys(translatedQuestion)[0]][0]
  });

  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    .withSimpleCard(requestAttributes.t('GAME_NAME'), repromptText)
    .getResponse();
}

function helpTheUser(newGame, handlerInput) {
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const askMessage = newGame
    ? requestAttributes.t('ASK_MESSAGE_START')
    : requestAttributes.t('REPEAT_QUESTION_MESSAGE') + requestAttributes.t('STOP_MESSAGE');
  const speechOutput = requestAttributes.t('HELP_MESSAGE', GAME_LENGTH) + askMessage;
  const repromptText = requestAttributes.t('HELP_REPROMPT') + askMessage;

  return handlerInput.responseBuilder.speak(speechOutput).reprompt(repromptText).getResponse();
}

/* jshint -W101 */
const languageString = {
  en: {
    translation: {
      QUESTIONS: questions.QUESTIONS_EN_US,
      GAME_NAME: 'A Exam Assessment',
      HELP_MESSAGE: 'I will ask you %s multiple choice questions. Respond with the number of the answer. For example, say one, two, three, or four. To start a new game at any time, say, start game. ',
      REPEAT_QUESTION_MESSAGE: 'To repeat the last question, say, repeat.',
      ASK_MESSAGE_START: 'Would you like to start playing?',
      HELP_REPROMPT: 'To give an answer to a question, respond with the number of the answer.',
      STOP_MESSAGE: 'Would you like to keep playing?',
      CANCEL_MESSAGE: 'Ok, let\'s play again soon.',
      NO_MESSAGE: 'Ok, we\'ll play another time. Goodbye!',
      TRIVIA_UNHANDLED: 'Try saying a number between 1 and %s',
      HELP_UNHANDLED: 'Say yes to continue, or no to end the game.',
      START_UNHANDLED: 'Say start to start a new game.',
      NEW_GAME_MESSAGE: 'Welcome to %s. ',
      WELCOME_MESSAGE: 'I will ask you %s questions, try to get as many right as you can. Just say the number of the answer. Respond with the number of the answer. For example, say one, two, three, or four.Let\'s begin.',
      ANSWER_CORRECT_MESSAGE: 'correct. ',
      ANSWER_WRONG_MESSAGE: 'wrong. ',
      //CORRECT_ANSWER_MESSAGE: 'The correct answer is %s: %s. ',
      //ANSWER_IS_MESSAGE: 'That answer is ',
      TELL_QUESTION_MESSAGE: 'Question %s. %s ',
      GAME_OVER_MESSAGE:'I\'d like to add your name to the leaderboard, what\'s your name?',
      //SCORE_IS_MESSAGE: 'Your score is %s. '
    },
  },
   en: {
    translation: {
      QUESTIONS: questions.QUESTIONS_EN_GB,
      GAME_NAME: 'A Exam Assessment',
      HELP_MESSAGE: 'I will ask you %s multiple choice questions. Respond with the number of the answer. For example, say one, two, three, or four. To start a new game at any time, say, start game. ',
      REPEAT_QUESTION_MESSAGE: 'To repeat the last question, say, repeat.',
      ASK_MESSAGE_START: 'Would you like to start playing?',
      HELP_REPROMPT: 'To give an answer to a question, respond with the number of the answer.',
      STOP_MESSAGE: 'Would you like to keep playing?',
      CANCEL_MESSAGE: 'Ok, let\'s play again soon.',
      NO_MESSAGE: 'Ok, we\'ll play another time. Goodbye!',
      TRIVIA_UNHANDLED: 'Try saying a number between 1 and %s',
      HELP_UNHANDLED: 'Say yes to continue, or no to end the game.',
      START_UNHANDLED: 'Say start to start a new game.',
      NEW_GAME_MESSAGE: 'Welcome to %s. ',
      WELCOME_MESSAGE: 'I will ask you %s questions, try to get as many right as you can. Just say the number of the answer. Respond with the number of the answer. For example, say one, two, three, or four.Let\'s begin.',
      ANSWER_CORRECT_MESSAGE: 'correct. ',
      ANSWER_WRONG_MESSAGE: 'wrong. ',
      //CORRECT_ANSWER_MESSAGE: 'The correct answer is %s: %s. ',
      //ANSWER_IS_MESSAGE: 'That answer is ',
      TELL_QUESTION_MESSAGE: 'Question %s. %s ',
      GAME_OVER_MESSAGE:'I\'d like to add your name to the leaderboard, what\'s your name?',
     // SCORE_IS_MESSAGE: 'Your score is %s. '
    },
  },
};
//'You got %s out of %s questions correct.

const LocalizationInterceptor = {
  process(handlerInput) {
    const localizationClient = i18n.use(sprintf).init({
      lng: handlerInput.requestEnvelope.request.locale,
      overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
      resources: languageString,
      returnObjects: true
    });

    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function (...args) {
      return localizationClient.t(...args);
    };
  },
};

const LaunchRequest = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return request.type === 'LaunchRequest'
      || (request.type === 'IntentRequest'
        && request.intent.name === 'AMAZON.StartOverIntent');
  },
  handle(handlerInput) {
    return startGame(true, handlerInput);
  },
};


const HelpIntent = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    const newGame = !(sessionAttributes.questions);
    return helpTheUser(newGame, handlerInput);
  },
};

const UnhandledIntent = {
  canHandle() {
    return true;
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    if (Object.keys(sessionAttributes).length === 0) {
      const speechOutput = requestAttributes.t('START_UNHANDLED');
      return handlerInput.attributesManager
        .speak(speechOutput)
        .reprompt(speechOutput)
        .getResponse();
    } else if (sessionAttributes.questions) {
      const speechOutput = requestAttributes.t('TRIVIA_UNHANDLED', ANSWER_COUNT.toString());
      return handlerInput.attributesManager
        .speak(speechOutput)
        .reprompt(speechOutput)
        .getResponse();
    }
    const speechOutput = requestAttributes.t('HELP_UNHANDLED');
    return handlerInput.attributesManager.speak(speechOutput).reprompt(speechOutput).getResponse();
  },
};

const SessionEndedRequest = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const AnswerIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && (handlerInput.requestEnvelope.request.intent.name === 'AnswerIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'DontKnowIntent');
  },
  handle(handlerInput) {
    if (handlerInput.requestEnvelope.request.intent.name === 'AnswerIntent') {
      return handleUserGuess(false, handlerInput);
    }
    return handleUserGuess(true, handlerInput);
  },
};

const RepeatIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    return handlerInput.responseBuilder.speak(sessionAttributes.speechOutput)
      .reprompt(sessionAttributes.repromptText)
      .getResponse();
  },
};

const YesIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.YesIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    if (sessionAttributes.questions) {
      return handlerInput.responseBuilder.speak(sessionAttributes.speechOutput)
        .reprompt(sessionAttributes.repromptText)
        .getResponse();
    }
    return startGame(false, handlerInput);
  },
};


const StopIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = requestAttributes.t('STOP_MESSAGE');

    return handlerInput.responseBuilder.speak(speechOutput)
      .reprompt(speechOutput)
      .getResponse();
  },
};

const CancelIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = requestAttributes.t('CANCEL_MESSAGE');

    return handlerInput.responseBuilder.speak(speechOutput)
      .getResponse();
  },
};

const NoIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NoIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = requestAttributes.t('NO_MESSAGE');
    return handlerInput.responseBuilder.speak(speechOutput).getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Sorry, I can\'t understand the command. Please say again.')
      .reprompt('Sorry, I can\'t understand the command. Please say again.')
      .getResponse();
  },
};

const NameIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'GetNameIntent';
  },
  handle(handlerInput) {
    //get session attributes
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const request = handlerInput.requestEnvelope.request;
    let name = request.intent.slots.name.value;
    let score = attributes.score.toString();
    //dynamodb
    var AWS = require('aws-sdk');
    var ddb = new AWS.DynamoDB({apiVersion: '2012-10-08'});
    AWS.config.update({region: 'us-east-1'});
    
    var params = {
      TableName: 'rahultrivia',
      Item: {
        'name' : {S: name},
        'score' : {S: score},
      }
    };
    
    ddb.putItem(params, function(err,data){
      if (err) {
        console.log(err);
      }else {
        console.log('Success!');
      }
    });
    
    return handlerInput.responseBuilder
    .speak('Thanks ' + name + '! Your score has been added to the leaderboard. Thanks for playing!')
    .getResponse();
    
  },
};

const HighScoreHandler = {
  canHandle(handlerInput){
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'HighScoreHandler';
  },
  handle(handlerInput) {
     var AWS = require("aws-sdk");
     
     var docClient = new AWS.DynamoDB.DocumentClient();
     
     var params = {
       TableName : "rahultrivia",
       Limit: 5000
     };
     
     var scores;
     return docClient.scan(params).promise().then((data) => {
       scores = data.Items.sort(function (a,b) {
         if (a.score > b.score) {
           return -1;
         }
         if (a.score < b.score) {
           return 1;
         }
         return 0;
       });
       
       //console.log(scores);
       if (supportsDisplay(handlerInput)) {
         const myBackground = new Alexa.ImageHelper()
          .addImageInstance(Background.url)
          .getImage();
          const items = [
                          {
                            "textContext": {
                              "primaryText": {
                                "type": "RichText",
                                "text": 'Score: ' + scores[0].score
                              },
                              "secondaryText":{
                                "type": "PlainText",
                              "text": 'Score: ' + scores[0].score,
                            }
                          }
                         },
                          {
                            "textContext": {
                              "primaryText": {
                                "type": "RichText",
                                "text": 'Score: ' + scores[1].score
                              },
                              "secondaryText":{
                                "type": "PlainText",
                              "text": 'Score: ' + scores[1].score,
                            }
                          }
                         },
                          {
                            "textContext": {
                              "primaryText": {
                                "type": "RichText",
                                "text": 'Score: ' + scores[2].score
                              },
                              "secondaryText":{
                                "type": "PlainText",
                              "text": 'Score: ' + scores[2].score,
                            }
                          }
                         },
                      ];
              handlerInput.responseBuilder.addRenderTemplateDirective({
                         type: 'ListTemplate1',
                         token: 'string',
                         backButton: 'HIDDEN',
                         backgroundImage: myBackground,
                         title: 'Highest Scores',
                         listItems: items
              });
       }
       
       
       return handlerInput.responseBuilder
           .speak('Leaderboard queired, highest score goes to ' + scores[0].name + ',' + scores[1].name + ', and' + scores[2].name + '.')
           .getResponse();
     })
     .catch((error) => {
       console.error("Unable to query. Error:", JSON.stringify(error, null, 2));
     });
  }
}

const skillBuilder = Alexa.SkillBuilders.standard();
exports.handler = skillBuilder
  .addRequestHandlers(
    NameIntent,
    HighScoreHandler,
    LaunchRequest,
    HelpIntent,
    AnswerIntent,
    RepeatIntent,
    YesIntent,
    StopIntent,
    CancelIntent,
    NoIntent,
    SessionEndedRequest,
    UnhandledIntent
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();

//returns true if the skill is running on a device with a display(showispot)
function supportsDisplay(handlerInput) {
  var hasDisplay = 
    handlerInput.requestEnvelope.context && 
    handlerInput.requestEnvelope.context.System &&
    handlerInput.requestEnvelope.context.System.device &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display 
  console.log("Supported Interfaces are" + JSON.stringify(handlerInput.requestEnvelope.context.System.device.supportedInterfaces));
  return hasDisplay;
}
const Background = {
  title: 'acg1',
  url: 'https://s3.amazonaws.com/alexa.devs/ep4/acg1.jpg'
  
};



