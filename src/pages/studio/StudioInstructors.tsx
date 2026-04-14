import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, User } from 'lucide-react';
import StudioLayout from '@/components/layout/StudioLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import type { Instructor } from '@/types/class';

export default function StudioInstructors() {
    const { data, isLoading } = useQuery<Instructor[]>({
        queryKey: ['public-instructors'],
        queryFn: async () => (await api.get('/instructors')).data,
    });

    // Filter only active instructors
    const activeInstructors = data?.filter(i => i.is_active) || [];

    return (
        <StudioLayout>
            <section className="py-16 lg:py-24 bg-background">
                <div className="container mx-auto px-4 lg:px-8 space-y-12">
                    {/* Header */}
                    <div className="text-center max-w-3xl mx-auto">
                        <span className="text-sm font-body text-secondary tracking-widest uppercase mb-4 block">
                            Nuestro Equipo
                        </span>
                        <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-light text-foreground mb-6">
                            Instructores que
                            <br />
                            <span className="font-semibold">transforman vidas</span>
                        </h1>
                        <p className="font-body text-lg text-muted-foreground">
                            Cada uno de nuestros instructores esta certificado internacionalmente
                            y trae su propia pasion unica al estudio.
                        </p>
                    </div>

                    {/* Loading State */}
                    {isLoading && (
                        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div key={index} className="space-y-4">
                                    <Skeleton className="aspect-[3/4] w-full rounded-sm" />
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-6 w-40" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && activeInstructors.length === 0 && (
                        <Card>
                            <CardContent className="py-16 text-center text-muted-foreground">
                                <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
                                <p className="text-lg">Proximamente publicaremos a nuestro equipo.</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Instructor Cards - Same style as Instructors.tsx */}
                    {!isLoading && activeInstructors.length > 0 && (
                        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                            {activeInstructors.map((instructor, index) => (
                                <div
                                    key={instructor.id}
                                    className="group relative"
                                    style={{ animationDelay: `${index * 150}ms` }}
                                >
                                    {/* Image */}
                                    <div className="relative aspect-[3/4] overflow-hidden rounded-sm mb-6 bg-muted">
                                        {instructor.photo_url ? (
                                            <img
                                                src={instructor.photo_url}
                                                alt={instructor.display_name}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                                                <User className="h-24 w-24 text-muted-foreground/40" />
                                            </div>
                                        )}
                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                        {/* Contact Info on Hover */}
                                        <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                                            <div className="space-y-2 text-white text-sm">
                                                {instructor.email && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="h-4 w-4" />
                                                        <span>{instructor.email}</span>
                                                    </div>
                                                )}
                                                {instructor.phone && (
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="h-4 w-4" />
                                                        <span>{instructor.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <Button
                                                variant="heroOutline"
                                                size="sm"
                                                className="w-full mt-4 bg-background/90 backdrop-blur-sm"
                                                asChild
                                            >
                                                <a href="#horarios">
                                                    Ver clases de {instructor.display_name.split(' ')[0]}
                                                </a>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div>
                                        <span className="text-xs font-body text-secondary tracking-widest uppercase">
                                            Instructor
                                        </span>
                                        <h3 className="font-heading text-2xl font-semibold text-foreground mt-1 mb-2">
                                            {instructor.display_name}
                                        </h3>
                                        {instructor.specialties && instructor.specialties.length > 0 && (
                                            <span className="text-sm font-body text-primary mb-3 block">
                                                {instructor.specialties.slice(0, 3).join(' & ')}
                                            </span>
                                        )}
                                        {instructor.bio && (
                                            <p className="font-body text-muted-foreground text-sm line-clamp-3">
                                                {instructor.bio}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </StudioLayout>
    );
}
