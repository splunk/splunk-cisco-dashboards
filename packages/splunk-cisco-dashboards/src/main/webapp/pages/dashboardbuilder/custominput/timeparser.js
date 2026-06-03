/* This utility is for demonstration purposes only. It should not be used for validating time
or parsing time. */
import moment from '@splunk/moment';
import { parseTimeString } from '@splunk/time-range-utils/time';

const momentUnits = {
    s: 's',
    m: 'm',
    h: 'h',
    d: 'd',
    w: 'w',
    mon: 'M',
    q: 'Q',
    y: 'y',
};

const momentSnaps = {
    s: 'second',
    m: 'minute',
    h: 'hour',
    d: 'day',
    w: 'week',
    mon: 'month',
    q: 'quarter',
    y: 'year',
};

export default function parse(time, locale = 'en_US') {
    const parsed = parseTimeString(time);

    return new Promise((resolve) => {
        moment.locale(locale);
        if (time === '') {
            const error = new Error('Invalid time string');
            resolve({ error, time });
        } else if (!parsed.isFullyParsed) {
            const error = new Error('The time string could not be parsed');
            resolve({ error, time });
        } else if (parsed.type === 'iso') {
            resolve({ error: null, iso: time, time });
        } else if (parsed.type === 'epoch') {
            const date = moment.unix(parseFloat(time)).locale(locale);
            resolve({ error: null, iso: date.format(), time });
        } else {
            const date = moment().locale(locale);

            parsed.modifiers.forEach((mod) => {
                if (mod.amount && momentUnits[mod.unit]) {
                    date.add(mod.amount, momentUnits[mod.unit]);
                }
                if (mod.snap && momentSnaps[mod.snap]) {
                    // weekday snap not covered here
                    date.startOf(momentSnaps[mod.snap]);
                }
            });
            resolve({ error: null, iso: date.format(), time });
        }
    });
}
