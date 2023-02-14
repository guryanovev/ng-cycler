import { Cycler } from './cycler';
import { Destructor } from './destructor.type';
import { Subscription, Observable, Subscriber } from 'rxjs';

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

    describe('manage', () => {
        it('should accept destructor', () => {
            const c = new Cycler();

            c.manage(NOOP);

            expect(c.getDestructorsCount()).toBe(1);
        });

        it('should accept disposable', () => {
            const c = new Cycler();

            c.manage({
                dispose() {
                }
            });

            expect(c.getDestructorsCount()).toBe(1);
        });

        it('should accept subscription', () => {
            const c = new Cycler();

            c.manage({
                unsubscribe() {
                }
            });

            expect(c.getDestructorsCount()).toBe(1);
        });

        it('should return disposable', () => {
            const c = new Cycler();

            const disposable = c.manage(NOOP);

            expect(disposable).toHaveProperty('dispose');
        });
    });

    describe('manageAll', () => {
        it('should accept multiple arguments', () => {
            const c = new Cycler();

            c.manageAll(
                NOOP,
                {
                    dispose() {}
                },
                {
                    unsubscribe() {}
                }
            );

            expect(c.getDestructorsCount()).toBe(3);
        });
    });

    describe('manageTransient', () => {
        it('should put first destructor to queue', () => {
            const c = new Cycler();

            c.manageTransient('request1', NOOP);

            expect(c.getDestructorsCount()).toBe(1);
        });

        it('should not put second destructor to queue', () => {
            const c = new Cycler();

            c.manageTransient('request1', NOOP);
            c.manageTransient('request1', { dispose() {} });

            expect(c.getDestructorsCount()).toBe(1);
        });

        it('should finalize on dispose', () => {
            const c = new Cycler();

            const mockCallback = jest.fn();

            c.manageTransient('request1', mockCallback);
            c.dispose();

            expect(mockCallback.mock.calls).toHaveLength(1);
        });

        it('should finalize first before second', () => {
            const c = new Cycler();

            const mockCallback = jest.fn();

            c.manageTransient('request1', mockCallback);
            c.manageTransient('request1', () => {});

            expect(mockCallback.mock.calls).toHaveLength(1);
        });
    });

    describe('managedSubscribe', () => {
        it('should accept observable and handler', () => {
            const c = new Cycler();
            const observable = new Observable<number>(subscriber => {
                subscriber.next(2023);
            });

            const next = jest.fn();
            c.managedSubscribe(observable, next);

            expect(next).toBeCalledTimes(1);
            expect(next).toBeCalledWith(2023);
        });

        it('should keep destructor while observable not complete', () => {
            const c = new Cycler();

            const observable = new Observable<number>(subscriber => {
                subscriber.next(1);
            });

            c.managedSubscribe(observable, _ => {});
            expect(c.getDestructorsCount()).toBe(1);
        });

        it('should remove destructor once observable is complete', () => {
            const c = new Cycler();

            let outSubscriber: Subscriber<number> | null = null;
            const observable = new Observable<number>(subscriber => {
                outSubscriber = subscriber;
            });

            expect(c.getDestructorsCount()).toBe(0);

            c.managedSubscribe(observable, {
                next() {
                },
                error(err) {
                    fail(err);
                }
            });

            expect(c.getDestructorsCount()).toBe(1);

            outSubscriber!.next(1);
            outSubscriber!.complete();

            expect(c.getDestructorsCount()).toBe(0);
        });
    });
});
