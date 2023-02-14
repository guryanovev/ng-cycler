import { Disposable } from './disposable.interface';
import { OnDestroy } from '@angular/core';
import { Destructor } from './destructor.type';
import { Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Unsubscribable, Observer } from 'rxjs';

export class Cycler implements Disposable, OnDestroy {
    private _destructors: Destructor[] = [];
    private _transientDestructors: Record<string, Disposable> = {};

    /**
     * Gets an amount of destructors currently in the queue.
     */
    public getDestructorsCount(): number {
        return this._destructors.length;
    }

    /**
     * Disposes the Cycler causing all it's dependant managed
     * entities to be disposed. This method will be called
     * automatically by Angular if the Cycler is properly
     * provided.
     */
    public dispose(): void {
        for (let i = 0; i < this._destructors.length; i++){
            const destructor = this._destructors[i];
            destructor();
        }

        this._destructors = [];
    }

    /**
     * Angular lifecycle hook implementation. Expected to be
     * called by Angular automatically. There are two ways to
     * achieve that:
     *
     * ### Option 1: provide the Cycler object:
     * ```ts
     * import { Cycler } from 'ng-cycler';
     *
     * @Component({
     *   // ...
     *   providers: [Cycler] // provide component scope-related Cycler instance
     * })
     * export class MyComponent {
     *     constructor(private readonly _cycler: Cycler){
     *         // use _cycler wherever needed
     *     }
     * }
     * ```
     * ### Option 2: extend your component from Cycler:
     *
     * ```ts
     * import { Cycler } from 'ng-cycler';
     *
     * export class MyComponent extends Cycler {
     *     // use this. to call Cycler-related methods
     * }
     * ```
     */
    public ngOnDestroy(): void {
        this.dispose();
    }

    /**
     * Adds a Destructor to the disposal queue to be called once the Cycler
     * is finalized by Angular.
     *
     * @param destructor to be added to the disposal queue
     * @returns disposable that can be used to run the destructor at any
     * time by calling `dispose` method. In case of `dispose` forced
     * manually it will be excluded from the main disposal queue.
     */
    public manageDestructor(destructor: Destructor): Disposable {
        this._destructors.push(destructor);

        return {
            dispose: () => {
                const destructorIndex = this._destructors.indexOf(destructor);
                if (destructorIndex >= 0) {
                    destructor();
                    this._destructors.splice(destructorIndex, 1);
                }
            }
        }
    }

    /**
     * Adds a Disposable object to the disposal queue. The logic is the same
     * as for `manageDestructor` but using a Disposable instead of Destructor.
     *
     * See `manageDestructor` for details.
     *
     * @param disposable to be added to the disposal queue
     *
     * @returns disposable that wraps the original disposable. This new Disposable
     * can be used to finalize the current one and remove it from the queue at the
     * same time.
     */
    public manageDisposable(disposable: Disposable): Disposable {
        return this.manageDestructor(() => disposable.dispose());
    }

    /**
     * Adds a subscription to the disposal queue. The subscription will be
     * finalized (by calling `unsubscribe` method) once the Cycler instance
     * is disposed.
     *
     * @param {Unsubscribable} subscription to be added to the disposal queue.
     *
     * @returns {Disposable} disposable object that can be used to finalize
     * the subscription manually.
     */
    public manageSubscription(subscription: Unsubscribable): Disposable {
        return this.manageDestructor(() => subscription.unsubscribe());
    }

    /**
     * Adds a dependency to the disposal queue to be managed by the Cycler.
     *
     * The dependency could be one of the following:
     *
     *   * {@link Destructor} destructor - a callback will be invoked on dependency finalization;
     *   * {@link Disposable} disposable - the `dispose` method will be called on dependency finalization;
     *   * {@link Unsubscribable} subscription - the `unsubscribe` method will be called on dependency finalization;
     *
     * The dependency will be finalized on:
     *
     *   * the Cycler disposal by Angular;
     *   * manually by calling `dispose` on the result object;
     *
     * @param dependency to be added to the finalization queue.
     */
    public manage(dependency: Destructor | Disposable | Unsubscribable): Disposable {
        const disposable = dependency as Disposable;
        if (disposable.dispose !== undefined) {
            return this.manageDisposable(disposable);
        }

        const subscription = dependency as Subscription;
        if (subscription.unsubscribe !== undefined) {
            return this.manageSubscription(subscription);
        }

        return this.manageDestructor(dependency as Destructor);
    }

    /**
     * Adds multiple dependencies to the disposal queue.
     *
     * @param dependencies
     */
    public manageAll(...dependencies: (Destructor | Disposable | Unsubscribable)[]): void {
        for (let i = 0; i < dependencies.length; i++) {
            this.manage(dependencies[i]);
        }
    }

    public manageTransient(code: string, dependency: Destructor | Disposable | Unsubscribable): Disposable {
        if (this._transientDestructors[code]) {
            this._transientDestructors[code].dispose();
        }

        const result = this.manage(dependency);
        this._transientDestructors[code] = result;

        return result;
    }

    public managedSubscribe<T>(observable: Observable<T>, observerOrNext?: Partial<Observer<T>> | ((value: T) => void)): Disposable {
        let disposable: Disposable | null = null;

        const subscription = observable
            .pipe(
                finalize(() => {
                    if (disposable !== null) {
                        disposable.dispose();
                    }
                })
            )
            .subscribe(observerOrNext);

        disposable = this.manageSubscription(subscription);

        return disposable;
    }
}
