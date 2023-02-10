import { Disposable } from './disposable.interface';
import { OnDestroy } from '@angular/core';
import { Destructor } from './destructor.type';
import { Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Unsubscribable } from 'rxjs';

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

    public manageSubscription(subscription: Unsubscribable): Disposable {
        return this.manageDestructor(() => subscription.unsubscribe());
    }

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

    public manageTransient(code: string, destructor: Destructor): Disposable {
        if (this._transientDestructors[code]) {
            this._transientDestructors[code].dispose();
        }

        const result = this.manageDestructor(destructor);
        this._transientDestructors[code] = result;

        return result;
    }

    public manageTransientSubscription(code: string, subscription: Subscription) {
        return this.manageTransient(code, () => {
            subscription.unsubscribe();
        });
    }

    public manageSubscriptions(...subscriptions: Subscription[]) {
        for (const subscription of subscriptions) {
            this.manageSubscription(subscription);
        }
    }

    public managedSubscribe<T>(observable: Observable<T>, next: (value: T) => void) {
        let destructor: Destructor | null = null;

        const subscription = observable
            .pipe(
                finalize(() => {
                    if (destructor !== null) {
                        this._destructors = this._destructors.filter(d => d !== destructor);
                    }
                })
            )
            .subscribe(next);

        destructor = () => subscription.unsubscribe();
        return this.manageDestructor(destructor);
    }
}
