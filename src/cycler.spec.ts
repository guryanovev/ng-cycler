import { Cycler } from './cycler';
import { Destructor } from './destructor.type';
import { Subscription } from 'rxjs';

const NOOP: Destructor = () => {};

const createSubscriptionSpy = () => {
    return {
        unsubscribe: jest.fn()
    }
};

describe('cycler', () => {
    describe('dispose', () => {
        it('should dispose destructors', () => {
            const c = new Cycler();

            const mockCallback = jest.fn();

            c.manageDestructor(mockCallback);
            c.dispose();

            expect(mockCallback.mock.calls).toHaveLength(1);
        });

        it('should clear queue', () => {
            const c = new Cycler();

            c.manageDestructor(() => {});
            c.dispose();

            expect(c.getDestructorsCount()).toBe(0);
        });

        it('should not dispose manually disposed destructors', () => {
            const c = new Cycler();

            const mockCallback = jest.fn();

            const disposable = c.manageDestructor(mockCallback);
            disposable.dispose();
            c.dispose();

            expect(mockCallback.mock.calls).toHaveLength(1);
        });
    });

    describe('ngOnDestroy', () => {
        it('should just call dispose', () => {
            const c = new Cycler();

            c.manageDestructor(NOOP);
            c.ngOnDestroy();

            expect(c.getDestructorsCount()).toBe(0);
        });
    });

    describe('manageDestructor', () => {
        it('should accept a destructor', () => {
            const c = new Cycler();

            c.manageDestructor(() => {});
        });

        it('should put destructor to queue', () => {
            const c = new Cycler();

            c.manageDestructor(NOOP);

            expect(c.getDestructorsCount()).toBe(1);
        });

        it('should put multiple destructors', () => {
            const c = new Cycler();

            c.manageDestructor(NOOP);
            c.manageDestructor(NOOP);
            c.manageDestructor(NOOP);

            expect(c.getDestructorsCount()).toBe(3);
        });

        describe('produced disposable', () => {
            it('should trigger self destructor', () => {
                const c = new Cycler();

                const mockDestructor = jest.fn();
                const disposable = c.manageDestructor(mockDestructor);

                disposable.dispose();

                expect(mockDestructor.mock.calls).toHaveLength(1);
            });

            it('should remove self from queue', () => {
                const c = new Cycler();

                c.manageDestructor(NOOP);
                const mockDestructor = jest.fn();
                const disposable = c.manageDestructor(mockDestructor);
                c.manageDestructor(NOOP);

                expect(c.getDestructorsCount()).toBe(3);

                disposable.dispose();

                expect(c.getDestructorsCount()).toBe(2);
            });
        })
    });

    describe('manageDisposable', () => {
        it('should put item to disposal queue', () => {
            const c = new Cycler();

            c.manageDisposable({ dispose() {}});

            expect(c.getDestructorsCount()).toBe(1);
        });

        it('should produce disposable', () => {
            const c = new Cycler();

            const managedDisposable = c.manageDisposable({
                dispose() {
                }
            });

            expect(managedDisposable).toHaveProperty('dispose');
        });
    });

    describe('manageSubscription', () => {
        it('should put item to disposal queue', () => {
            const c = new Cycler();

            c.manageSubscription(Subscription.EMPTY);

            expect(c.getDestructorsCount()).toBe(1);
        });

        it('should unsubscribe on dispose', () => {
            const c = new Cycler();

            const subscriptionSpy = createSubscriptionSpy();
            c.manageSubscription(subscriptionSpy);

            c.dispose();
            expect(subscriptionSpy.unsubscribe).toBeCalledTimes(1);
        });

        it('should unsubscribe on self dispose', () => {
            const c = new Cycler();

            const subscriptionSpy = createSubscriptionSpy();
            const disposable = c.manageSubscription(subscriptionSpy);

            disposable.dispose();

            expect(subscriptionSpy.unsubscribe).toBeCalledTimes(1);
        });
    });
});
