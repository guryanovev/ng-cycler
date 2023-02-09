import { Disposable } from './disposable.interface';
import { OnDestroy } from '@angular/core';
import { Destructor } from './destructor.type';
import { Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

export class Cycler implements Disposable, OnDestroy {
    private _destructors: Destructor[] = [];
    private _transientDestructors: Record<string, Disposable> = {};

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

    public ngOnDestroy(): void {
        this.dispose();
    }

    public manage(dependency: Destructor | Disposable | Subscription): Disposable {
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

    public manageDestructor(destructor: Destructor): Disposable {
        this._destructors.push(destructor);

        return {
            dispose: () => {
                const destructorIndex = this._destructors.indexOf(destructor);
                if (destructorIndex > 0) {
                    destructor();
                    this._destructors.splice(destructorIndex, 1);
                }
            }
        }
    }

    public manageDisposable(disposable: Disposable): Disposable {
        return this.manageDestructor(() => disposable.dispose());
    }

    public manageTransient(code: string, destructor: Destructor): Disposable {
        if (this._transientDestructors[code]) {
            this._transientDestructors[code].dispose();
        }

        const result = this.manageDestructor(destructor);
        this._transientDestructors[code] = result;

        return result;
    }

    public manageSubscription(subscription: Subscription) {
        return this.manageDestructor(() => subscription.unsubscribe());
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
