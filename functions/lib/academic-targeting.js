'use strict';

function normalizeDigits(value) {
  return String(value || '')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776));
}

function normalizeAcademicValue(value) {
  return normalizeDigits(value)
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .trim()
    .toLocaleLowerCase('ar')
    .replace(/\s+/g, ' ');
}

function sameAcademicValue(left, right) {
  const leftValue = normalizeAcademicValue(left);
  const rightValue = normalizeAcademicValue(right);
  return Boolean(leftValue && rightValue && leftValue === rightValue);
}

function isAcademicWildcard(value, labels) {
  const normalized = normalizeAcademicValue(value);
  return !normalized || labels.some(label => normalizeAcademicValue(label) === normalized);
}

function scheduleMatchesStudent(schedule, student) {
  if (!schedule || !student || schedule.active === false) return false;
  if (!sameAcademicValue(schedule.grade, student.grade)) return false;
  if (!isAcademicWildcard(schedule.term, ['كل الترمات', 'all'])
    && student.term
    && !sameAcademicValue(schedule.term, student.term)) return false;
  if (!isAcademicWildcard(schedule.academicYear, ['كل الأعوام', 'all'])
    && student.academicYear
    && !sameAcademicValue(schedule.academicYear, student.academicYear)) return false;
  return true;
}

function learningTargetMatchesStudent(item, student) {
  if (!item || !student) return false;
  const gradeMatches = isAcademicWildcard(item.grade, ['كل الصفوف', 'all'])
    || sameAcademicValue(item.grade, student.grade);
  const groupMatches = isAcademicWildcard(item.group, ['كل المجموعات', 'all'])
    || sameAcademicValue(item.group, student.group);
  const termMatches = isAcademicWildcard(item.term, ['كل الترمات', 'all'])
    || !student.term
    || sameAcademicValue(item.term, student.term);
  const yearMatches = !item.academicYear
    || !student.academicYear
    || sameAcademicValue(item.academicYear, student.academicYear);
  return gradeMatches && groupMatches && termMatches && yearMatches;
}

module.exports = {
  normalizeAcademicValue,
  sameAcademicValue,
  scheduleMatchesStudent,
  learningTargetMatchesStudent
};
