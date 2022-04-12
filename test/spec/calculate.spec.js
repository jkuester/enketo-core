import config from 'enketo/config';
import loadForm from '../helpers/load-form';
import dialog from '../../src/js/fake-dialog';
import events from '../../src/js/event';

describe('calculate functionality', () => {
    /** @type {import('sinon').SinonSandbox} */
    let sandbox;

    /** @type {boolean} */
    let excludeNonRelevant;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        sandbox.stub(dialog, 'confirm').resolves(true);

        excludeNonRelevant = false;

        sandbox
            .stub(config, 'excludeNonRelevant')
            .get(() => excludeNonRelevant);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('relevant calculations cascade from a view change', () => {
        const form = loadForm('calcs-cascade.xml');

        form.init();

        const firstInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/first"]'
        );
        const secondInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/second"]'
        );
        const thirdInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/third"]'
        );
        const firstModel = form.model.xml.querySelector('first');
        const secondModel = form.model.xml.querySelector('second');
        const thirdModel = form.model.xml.querySelector('third');

        firstInput.value = 1;
        firstInput.dispatchEvent(events.Change());

        expect(firstInput.value).to.equal('1');
        expect(secondInput.value).to.equal('3');
        expect(thirdInput.value).to.equal('6');
        expect(firstModel.textContent).to.equal('1');
        expect(secondModel.textContent).to.equal('3');
        expect(thirdModel.textContent).to.equal('6');
    });

    it('relevant calculations cascade from a model change', () => {
        const form = loadForm('calcs-cascade.xml');

        form.init();

        const firstInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/first"]'
        );
        const secondInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/second"]'
        );
        const thirdInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/third"]'
        );
        const firstModel = form.model.xml.querySelector('first');
        const secondModel = form.model.xml.querySelector('second');
        const thirdModel = form.model.xml.querySelector('third');

        firstInput.value = '1';
        form.model.node(firstInput.name).setVal('1');

        expect(firstInput.value).to.equal('1');
        expect(secondInput.value).to.equal('3');
        expect(thirdInput.value).to.equal('6');
        expect(firstModel.textContent).to.equal('1');
        expect(secondModel.textContent).to.equal('3');
        expect(thirdModel.textContent).to.equal('6');
    });

    it('updates inside multiple repeats when repeats become relevant', () => {
        const form = loadForm('repeat-relevant-calculate.xml');
        form.init();

        // This triggers a form.calc.update with this object: { relevantPath: '/data/rg' };
        form.view.$.find('[name="/data/yn"]')
            .prop('checked', true)
            .trigger('change');

        expect(
            form.model
                .node('/data/rg/row')
                .getElements()
                .map((node) => node.textContent)
                .join(',')
        ).to.equal('1,2,3');
        expect(form.view.$.find('[name="/data/rg/row"]')[0].value).to.equal(
            '1'
        );
        expect(form.view.$.find('[name="/data/rg/row"]')[1].value).to.equal(
            '2'
        );
        expect(form.view.$.find('[name="/data/rg/row"]')[2].value).to.equal(
            '3'
        );
    });

    it('updates inside multiple repeats a repeat is removed and position(..) changes', (done) => {
        const form = loadForm('repeat-relevant-calculate.xml');
        form.init();

        form.view.$.find('[name="/data/yn"]')
            .prop('checked', true)
            .trigger('change');

        // remove first repeat to the calculation in both remaining repeats needs to be updated.
        form.view.html.querySelector('.btn.remove').click();

        setTimeout(() => {
            expect(
                form.model
                    .node('/data/rg/row')
                    .getElements()
                    .map((node) => node.textContent)
                    .join(',')
            ).to.equal('1,2');
            expect(form.view.$.find('[name="/data/rg/row"]')[0].value).to.equal(
                '1'
            );
            expect(form.view.$.find('[name="/data/rg/row"]')[1].value).to.equal(
                '2'
            );
            done();
        }, 650);
    });

    it('updates a calculation for node if calc refers to node filtered with predicate', () => {
        const form = loadForm('count-repeated-nodes.xml');
        form.init();

        const text1 = form.view.html.querySelector(
            'textarea[name="/repeat-group-comparison/REP/text1"]'
        );

        text1.value = ' yes ';
        text1.dispatchEvent(events.Change());

        expect(
            form.view.html.querySelector(
                'input[name="/repeat-group-comparison/count2"]'
            ).value
        ).to.equal('1');
    });

    it('does not calculate questions inside repeat instances created with repeat-count, if the repeat is not relevant', () => {
        const form = loadForm('repeat-count-calculate-irrelevant.xml');
        form.init();

        const calcs = form.model.xml.querySelectorAll('SHD_NO');

        expect(calcs.length).to.equal(3);
        expect(calcs[0].textContent).to.equal('');
        expect(calcs[1].textContent).to.equal('');
        expect(calcs[2].textContent).to.equal('');
    });

    // This is important for OpenClinica, but also reduces unnecessary work. A calculation that runs upon form load and
    // doesn't change a default, or loaded, value doesn't have to populate the form control, as this will be done by setAllVals
    it('does not set the form control value if the calculation result does not change the value in the model', () => {
        const form = loadForm(
            'calc-control.xml',
            '<data><calc>12</calc></data>'
        );

        let counter = 0;
        form.view.html
            .querySelector('[name="/data/calc"]')
            .addEventListener(new events.InputUpdate().type, () => counter++);
        form.init();

        expect(counter).to.equal(0);
    });

    // https://github.com/OpenClinica/enketo-express-oc/issues/404#issuecomment-744743172
    // Checks whether different types of calculations are handled consistently when they become non-relevant
    it('consistently leaves calculated values if they become non-relevant', () => {
        const form = loadForm('relevant-calcs.xml');
        form.init();
        const grp = form.model.xml.querySelector('grp');

        expect(grp.textContent.replace(/\s/g, '')).to.equal('five');

        const a = form.view.html.querySelector('input[name="/data/a"]');
        a.value = 'a';
        a.dispatchEvent(events.Change());

        expect(grp.textContent.replace(/\s/g, '')).to.equal(
            'onetwothreefourfive'
        );

        a.value = '';
        a.dispatchEvent(events.Change());

        expect(grp.textContent.replace(/\s/g, '')).to.equal(
            'onetwothreefourfive'
        );
    });

    describe('Excluding non-relevant nodes', () => {
        /** @type {import('sinon').SinonFakeTimers} */
        let timers;

        beforeEach(() => {
            excludeNonRelevant = true;
            timers = sandbox.useFakeTimers(Date.now());
        });

        afterEach(() => {
            timers.runAll();
            timers.clearTimeout();
            timers.clearInterval();
            timers.restore();
        });

        it('recalculates non-relevant values when they are excluded from calculations', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();
            timers.runAll();

            const grp = form.model.xml.querySelector('grp');

            timers.runAll();

            expect(grp.textContent.replace(/\s/g, '')).to.equal('');

            const a = form.view.html.querySelector('input[name="/data/a"]');

            a.value = 'a';
            a.dispatchEvent(events.Change());

            timers.runAll();

            expect(grp.textContent.replace(/\s/g, '')).to.equal(
                'onetwothreefourfive'
            );

            a.value = '';
            a.dispatchEvent(events.Change());

            timers.runAll();

            expect(grp.textContent.replace(/\s/g, '')).to.equal('');
        });

        it('recalculates relevant values when they are restored', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();
            timers.runAll();

            const grp = form.model.xml.querySelector('grp');

            timers.runAll();

            expect(grp.textContent.replace(/\s/g, '')).to.equal('');

            const a = form.view.html.querySelector('input[name="/data/a"]');

            a.value = 'a';
            a.dispatchEvent(events.Change());

            timers.runAll();

            expect(grp.textContent.replace(/\s/g, '')).to.equal(
                'onetwothreefourfive'
            );

            a.value = '';
            a.dispatchEvent(events.Change());

            timers.runAll();

            a.value = 'a';
            a.dispatchEvent(events.Change());

            timers.runAll();

            expect(grp.textContent.replace(/\s/g, '')).to.equal(
                'onetwothreefourfive'
            );
        });

        it('excludes children of non-relevant parents from calculations', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();
            timers.runAll();

            const child = form.model.xml.querySelector('is-child-relevant');

            timers.runAll();

            expect(child.textContent).to.equal('');

            const setsGroupRelevance = form.view.html.querySelector(
                'input[name="/data/sets-group-relevance"]'
            );
            const setsChildRelevance = form.view.html.querySelector(
                'input[name="/data/sets-child-relevance"]'
            );

            setsGroupRelevance.value = '1';
            setsGroupRelevance.dispatchEvent(events.Change());

            timers.runAll();

            setsChildRelevance.value = '2';
            setsChildRelevance.dispatchEvent(events.Change());

            timers.runAll();

            expect(child.textContent).to.equal('is relevant');

            setsGroupRelevance.value = '';
            setsGroupRelevance.dispatchEvent(events.Change());

            timers.runAll();

            expect(child.textContent).to.equal('');
        });

        it('restores relevance of calculations of children of non-relevant when their parents become relevant', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();
            timers.runAll();

            const child = form.model.xml.querySelector('is-child-relevant');

            timers.runAll();

            expect(child.textContent).to.equal('');

            const setsGroupRelevance = form.view.html.querySelector(
                'input[name="/data/sets-group-relevance"]'
            );
            const setsChildRelevance = form.view.html.querySelector(
                'input[name="/data/sets-child-relevance"]'
            );

            setsGroupRelevance.value = '1';
            setsGroupRelevance.dispatchEvent(events.Change());

            timers.runAll();

            setsChildRelevance.value = '2';
            setsChildRelevance.dispatchEvent(events.Change());

            timers.runAll();

            expect(child.textContent).to.equal('is relevant');

            setsGroupRelevance.value = '';
            setsGroupRelevance.dispatchEvent(events.Change());

            timers.runAll();

            setsGroupRelevance.value = '1';
            setsGroupRelevance.dispatchEvent(events.Change());

            timers.runAll();

            expect(child.textContent).to.equal('is relevant');
        });

        // Note (2022/03/09): this behavior is currently inconsistent with JavaRosa
        it('recalculates when a non-relevant field becomes relevant', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();
            timers.runAll();

            const now = form.model.xml.querySelector('now');

            timers.runAll();

            const initialValue = new Date(now.textContent).getTime();

            expect(Number.isNaN(initialValue)).not.to.be.true;

            const toggleNow = form.view.html.querySelector(
                'input[name="/data/toggle-now"]'
            );

            toggleNow.value = '';
            toggleNow.dispatchEvent(events.Change());

            timers.runAll();

            toggleNow.value = '1';
            toggleNow.dispatchEvent(events.Change());

            timers.runAll();

            const recalculatedValue = new Date(now.textContent).getTime();

            expect(recalculatedValue).to.be.greaterThan(initialValue);
        });

        it('recalculates when a non-relevant group becomes relevant', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();
            timers.runAll();

            const now = form.model.xml.querySelector('now-grouped now');

            timers.runAll();

            const initialValue = new Date(now.textContent).getTime();

            expect(Number.isNaN(initialValue)).not.to.be.true;

            const toggleNow = form.view.html.querySelector(
                'input[name="/data/toggle-now"]'
            );

            toggleNow.value = '';
            toggleNow.dispatchEvent(events.Change());

            timers.runAll();

            toggleNow.value = '1';
            toggleNow.dispatchEvent(events.Change());

            timers.runAll();

            const recalculatedValue = new Date(now.textContent).getTime();

            expect(recalculatedValue).to.be.greaterThan(initialValue);
        });

        it('recalculates becoming relevant after becoming non-relevant', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();
            timers.runAll();

            const computedByChild =
                form.model.xml.querySelector('computed-by-child');

            timers.runAll();

            const initialValue = computedByChild.textContent;

            expect(initialValue).to.equal('');

            const setsGroupRelevance = form.view.html.querySelector(
                'input[name="/data/sets-group-relevance"]'
            );
            const setsChildRelevance = form.view.html.querySelector(
                'input[name="/data/sets-child-relevance"]'
            );

            setsGroupRelevance.value = '1';
            setsGroupRelevance.dispatchEvent(events.Change());

            timers.runAll();

            setsChildRelevance.value = '2';
            setsChildRelevance.dispatchEvent(events.Change());

            timers.runAll();

            expect(computedByChild.textContent).to.equal('is relevant');

            setsChildRelevance.value = '';
            setsChildRelevance.dispatchEvent(events.Change());

            timers.runAll();

            expect(computedByChild.textContent).to.equal('');

            setsChildRelevance.value = '2';
            setsChildRelevance.dispatchEvent(events.Change());

            timers.runAll();

            expect(computedByChild.textContent).to.equal('is relevant');
        });

        it('restores values set arbitrarily when a node becomes relevant', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();
            timers.runAll();

            const assignAnyValue =
                form.model.xml.querySelector('assign-any-value');

            timers.runAll();

            const initialValue = assignAnyValue.textContent;

            expect(initialValue).to.equal('');

            const setsRelevance = form.view.html.querySelector(
                'input[name="/data/sets-assign-any-value-relevance"]'
            );

            setsRelevance.value = '1';
            setsRelevance.dispatchEvent(events.Change());

            timers.runAll();

            const assignAnyValueInput = form.view.html.querySelector(
                'input[name="/data/assign-any-value"]'
            );

            assignAnyValueInput.value = 'any value';
            assignAnyValueInput.dispatchEvent(events.Change());

            timers.runAll();

            expect(assignAnyValue.textContent).to.equal('any value');

            setsRelevance.value = '';
            setsRelevance.dispatchEvent(events.Change());

            timers.runAll();

            expect(assignAnyValue.textContent).to.equal('');

            setsRelevance.value = '1';
            setsRelevance.dispatchEvent(events.Change());

            timers.runAll();

            expect(assignAnyValue.textContent).to.equal('any value');
        });

        it('updates recalculated values in the view', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();
            timers.runAll();

            const assignAnyValue =
                form.model.xml.querySelector('assign-any-value');

            timers.runAll();

            const initialValue = assignAnyValue.textContent;

            expect(initialValue).to.equal('');

            const setsRelevance = form.view.html.querySelector(
                'input[name="/data/sets-assign-any-value-relevance"]'
            );

            const calculated = form.view.html.querySelector(
                'input[name="/data/calc-by-assign-any-value"]'
            );

            timers.runAll();

            expect(calculated.value).to.equal('');

            setsRelevance.value = '1';
            setsRelevance.dispatchEvent(events.Change());

            timers.runAll();

            const assignAnyValueInput = form.view.html.querySelector(
                'input[name="/data/assign-any-value"]'
            );

            assignAnyValueInput.value = 'any value';
            assignAnyValueInput.dispatchEvent(events.Change());

            timers.runAll();

            expect(calculated.value).to.equal('any value');

            setsRelevance.value = '';
            setsRelevance.dispatchEvent(events.Change());

            timers.runAll();

            expect(calculated.value).to.equal('');

            setsRelevance.value = '1';
            setsRelevance.dispatchEvent(events.Change());

            timers.runAll();

            expect(calculated.value).to.equal('any value');
        });

        it('does not recalculate unrelated questions when another field becomes non-relevant', () => {
            const form = loadForm('recalculations.xml');

            form.init();
            timers.runAll();

            const q1 = form.view.html.querySelector(
                'input[name="/recalculations/q1"]'
            );
            const q2 = form.view.html.querySelector(
                'input[name="/recalculations/q2"]'
            );
            const q3 = form.view.html.querySelector(
                'input[name="/recalculations/q3"]'
            );

            q1.value = '1';
            q1.dispatchEvent(events.Change());

            timers.runAll();

            expect(q2.value).to.equal('7');

            q2.value = '8';
            q3.dispatchEvent(events.Change());

            timers.runAll();

            const calculationUpdateSpy = sandbox.spy(form.calc, 'updateCalc');

            q3.value = '1';
            q3.dispatchEvent(events.Change());

            timers.runAll();

            expect(calculationUpdateSpy).not.to.have.been.calledWith(q2);
            expect(q2.value).to.equal('8');
        });

        it('updates relevancy of related nodes when recalculated (large WHO form)', () => {
            const form = loadForm('va_who_v1_5_3.xml');

            form.init();
            timers.runAll();

            const didConsent = form.view.html.querySelector(
                '[name="/data/respondent_backgr/Id10013"][value="yes"]'
            );
            const consentedGroup =
                form.model.xml.querySelector('data consented');

            expect(consentedGroup.textContent.trim()).to.equal('');

            didConsent.checked = true;
            didConsent.dispatchEvent(events.Change());

            timers.runAll();

            const isDateOfBirthKnown = form.view.html.querySelector(
                '[name="/data/consented/deceased_CRVS/info_on_deceased/Id10020"][value="yes"]'
            );

            isDateOfBirthKnown.checked = true;
            isDateOfBirthKnown.dispatchEvent(events.Change());

            timers.runAll();

            const dateOfBirth = form.view.html.querySelector(
                '[name="/data/consented/deceased_CRVS/info_on_deceased/Id10021"]'
            );

            const adultDateOfBirth = new Date();

            adultDateOfBirth.setFullYear(adultDateOfBirth.getFullYear() - 18);

            const adultDateOfBirthValue = adultDateOfBirth
                .toISOString()
                .replace(/T.*$/, '');

            dateOfBirth.value = adultDateOfBirthValue;
            dateOfBirth.dispatchEvent(events.Change());

            timers.runAll();

            const isDateOfDeathKnown = form.view.html.querySelector(
                '[name="/data/consented/deceased_CRVS/info_on_deceased/Id10022"][value="no"]'
            );

            isDateOfDeathKnown.checked = true;
            isDateOfDeathKnown.dispatchEvent(events.Change());

            timers.runAll();

            const yearOfDeath = form.view.html.querySelector(
                '[name="/data/consented/deceased_CRVS/info_on_deceased/Id10024"]'
            );
            const yearOfDeathValue = new Date()
                .toISOString()
                .replace(/T.*$/, '');

            yearOfDeath.value = yearOfDeathValue;
            yearOfDeath.dispatchEvent(events.Change());

            timers.runAll();

            const ageGroup = form.view.html.querySelector(
                '[name="/data/consented/deceased_CRVS/info_on_deceased/age_group"][value="adult"]'
            );

            ageGroup.checked = true;
            ageGroup.dispatchEvent(events.Change());

            timers.runAll();

            const didHaveFever = form.view.html.querySelector(
                '[name="/data/consented/illhistory/signs_symptoms_final_illness/Id10147"][value="yes"]'
            );

            didHaveFever.checked = true;
            didHaveFever.dispatchEvent(events.Change());

            timers.runAll();

            const feverDurationDayUnit = form.view.html.querySelector(
                '[name="/data/consented/illhistory/signs_symptoms_final_illness/Id10148_units"][value="days"]'
            );

            feverDurationDayUnit.checked = true;
            feverDurationDayUnit.dispatchEvent(events.Change());

            timers.runAll();

            const feverDurationDays = form.view.html.querySelector(
                '[name="/data/consented/illhistory/signs_symptoms_final_illness/Id10148_b"]'
            );

            feverDurationDays.value = '36';
            feverDurationDays.dispatchEvent(events.Change());

            timers.runAll();

            const isDateOfBirthKnownModelNode = form.model
                .node(isDateOfBirthKnown.name)
                .getElement();
            const dateOfBirthModelNode = form.model
                .node(dateOfBirth.name)
                .getElement();
            const isDateOfDeathKnownModelNode = form.model
                .node(isDateOfDeathKnown.name)
                .getElement();
            const yearOfDeathModelNode = form.model
                .node(yearOfDeath.name)
                .getElement();
            const ageGroupModelNode = form.model
                .node(ageGroup.name)
                .getElement();
            const didHaveFeverModelNode = form.model
                .node(didHaveFever.name)
                .getElement();
            const feverDurationDayUnitModelNode = form.model
                .node(feverDurationDayUnit.name)
                .getElement();
            const feverDurationDaysModelNode = form.model
                .node(feverDurationDays.name)
                .getElement();

            expect(isDateOfBirthKnownModelNode.textContent).to.equal('yes');
            expect(dateOfBirthModelNode.textContent).to.equal(
                adultDateOfBirthValue
            );
            expect(isDateOfDeathKnownModelNode.textContent).to.equal('no');
            expect(yearOfDeathModelNode.textContent).to.equal(yearOfDeathValue);
            expect(ageGroupModelNode.textContent).to.equal('adult');
            expect(didHaveFeverModelNode.textContent).to.equal('yes');
            expect(feverDurationDayUnitModelNode.textContent).to.equal('days');
            expect(feverDurationDaysModelNode.textContent).to.equal('36');

            didHaveFever.checked = false;
            didHaveFever.dispatchEvent(events.Change());

            timers.runAll();

            expect(feverDurationDayUnitModelNode.textContent).to.equal('');
            expect(feverDurationDaysModelNode.textContent).to.equal('');

            didHaveFever.checked = true;
            didHaveFever.dispatchEvent(events.Change());

            timers.runAll();

            expect(feverDurationDayUnitModelNode.textContent).to.equal('days');
            expect(feverDurationDaysModelNode.textContent).to.equal('36');
        }, 1000000);

        // This test, as with the larger one above, should be moved to a relevance-specific suite.
        // But I am le tired.
        it('updates relevancy of related nodes when recalculated (minimal repro)', () => {
            const form = loadForm('va-who-minimal.xml');

            form.init();
            timers.runAll();

            const didHaveFever = form.view.html.querySelector(
                '[name="/data/consented/illhistory/signs_symptoms_final_illness/did-have-fever"]'
            );

            didHaveFever.value = 'yes';
            didHaveFever.dispatchEvent(events.Change());

            timers.runAll();

            const feverDurationDayUnit = form.view.html.querySelector(
                '[name="/data/consented/illhistory/signs_symptoms_final_illness/fever-duration-unit"]'
            );

            feverDurationDayUnit.value = 'days';
            feverDurationDayUnit.dispatchEvent(events.Change());

            timers.runAll();

            const feverDurationDays = form.view.html.querySelector(
                '[name="/data/consented/illhistory/signs_symptoms_final_illness/fever-duration-days"]'
            );

            feverDurationDays.value = '36';
            feverDurationDays.dispatchEvent(events.Change());

            timers.runAll();

            const didHaveFeverModelNode = form.model
                .node(didHaveFever.name)
                .getElement();
            const feverDurationDayUnitModelNode = form.model
                .node(feverDurationDayUnit.name)
                .getElement();
            const feverDurationDaysModelNode = form.model
                .node(feverDurationDays.name)
                .getElement();

            expect(didHaveFeverModelNode.textContent).to.equal('yes');
            expect(feverDurationDayUnitModelNode.textContent).to.equal('days');
            expect(feverDurationDaysModelNode.textContent).to.equal('36');

            didHaveFever.value = 'no';
            didHaveFever.dispatchEvent(events.Change());

            timers.runAll();

            expect(feverDurationDayUnitModelNode.textContent).to.equal('');
            expect(feverDurationDaysModelNode.textContent).to.equal('');

            didHaveFever.value = 'yes';
            didHaveFever.dispatchEvent(events.Change());

            timers.runAll();

            expect(feverDurationDayUnitModelNode.textContent).to.equal('days');
            expect(feverDurationDaysModelNode.textContent).to.equal('36');
        });
    });
});
