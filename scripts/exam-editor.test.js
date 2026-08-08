'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const editor = require('../assets/exam-editor');

test('keeps the selected answer as a deterministic numeric index', () => {
  const result = editor.serializeQuestions([{
    type:'mcq', question:'اختر الإجابة', options:['الأولى','الثانية','الثالثة','الرابعة'], correctIndex:2, points:2
  }]);
  assert.equal(result.ok, true);
  assert.equal(result.questions[0].correctIndex, 2);
  assert.match(result.text, /الإجابة: ج/);
});

test('understands legacy Arabic, English, numeric, and answer-text values', () => {
  const options=['واحد','اثنان','ثلاثة','أربعة'];
  assert.equal(editor.answerIndex({answer:'ب',options}), 1);
  assert.equal(editor.answerIndex({answer:'C',options}), 2);
  assert.equal(editor.answerIndex({answer:'4',options}), 3);
  assert.equal(editor.answerIndex({answer:'اثنان',options}), 1);
});

test('serializes true/false and rejects incomplete questions', () => {
  const valid=editor.serializeQuestions([{type:'truefalse',question:'الضوء موجة',correctIndex:0,points:1}]);
  assert.equal(valid.ok,true);
  assert.deepEqual(valid.questions[0].options,['صح','غلط']);
  assert.equal(editor.serializeQuestions([{type:'mcq',question:'ناقص',options:['أ','','ج','د'],correctIndex:0}]).ok,false);
});
