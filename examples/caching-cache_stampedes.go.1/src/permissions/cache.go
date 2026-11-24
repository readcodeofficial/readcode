package permissions

import (
	"context"
	"errors"
	"math/rand"
	"time"

	gocache "github.com/patrickmn/go-cache"
	"golang.org/x/sync/singleflight"
)

const (
	positiveTTL = 5 * time.Minute
	negativeTTL = 20 * time.Second
	jitterRange = 60 * time.Second
)

type negativeEntry struct{}

type CachedResolver struct {
	store Store
	cache *gocache.Cache
	group singleflight.Group
}

func NewCachedResolver(store Store) *CachedResolver {
	return &CachedResolver{
		store: store,
		cache: gocache.New(positiveTTL, time.Minute),
	}
}

func (r *CachedResolver) Resolve(ctx context.Context, userID string) (*Set, error) {
	if v, ok := r.cache.Get(userID); ok {
		if _, missing := v.(negativeEntry); missing {
			return nil, ErrUserNotFound
		}
		return v.(*Set), nil
	}

	v, err, _ := r.group.Do(userID, func() (interface{}, error) {
		return r.load(ctx, userID)
	})
	if err != nil {
		return nil, err
	}
	return v.(*Set), nil
}

func (r *CachedResolver) load(ctx context.Context, userID string) (*Set, error) {
	if v, ok := r.cache.Get(userID); ok {
		if set, isSet := v.(*Set); isSet {
			return set, nil
		}
	}

	set, err := r.store.LoadPermissions(ctx, userID)
	if errors.Is(err, ErrUserNotFound) {
		r.cache.Set(userID, negativeEntry{}, negativeTTL)
		return nil, err
	}
	if err != nil {
		return nil, err
	}

	ttl := positiveTTL + time.Duration(rand.Int63n(int64(jitterRange)))
	r.cache.Set(userID, set, ttl)
	return set, nil
}

func (r *CachedResolver) Invalidate(userID string) {
	r.cache.Delete(userID)
	r.group.Forget(userID)
}
